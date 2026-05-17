import json
import re
from bs4 import BeautifulSoup

def normalize(title):
    title = title.lower().strip()
    # Remove 'special session paper' suffixes
    title = re.sub(r'\(?special session paper\)?', '', title)
    # Remove punctuation
    title = re.sub(r'[^\w\s]', '', title)
    # Normalize whitespace
    title = " ".join(title.split())
    return title

# Load Google Scholar data
with open('google-scholar-papers.json', 'r') as f:
    scholar_data = json.load(f)

scholar_all = scholar_data.get('publications', [])

# Filtering Scholar data
# Rules: 
# 1. Venue does NOT contain 'US Patent App.'
# 2. MUST contain 'US Patent' for patents OR one of the non-patent sections? 
#    Actually the prompt says: "contain either 'US Patent' for patents or one of the non-patent sections"
#    Sections: journals, conferences, book chapters, books, dissertation, and patents.
#    Wait, the prompt says "include page sections for journals, conferences, book chapters, books, dissertation, and patents".
#    And for Scholar: "include only entries whose venue does NOT contain 'US Patent App.' and DOES contain either 'US Patent' for patents or one of the non-patent sections."

sections = ['journal', 'conference', 'book chapter', 'book', 'dissertation', 'patent']

filtered_scholar = []
for p in scholar_all:
    venue = p.get('venue', '')
    title = p.get('title', '')
    
    if 'US Patent App.' in venue:
        continue
        
    # Check if it contains 'US Patent' or any of the section names
    # Note: The prompt doesn't specify if the venue must contain the section names or if the entry matches the section.
    # "DOES contain either 'US Patent' for patents or one of the non-patent sections"
    match_section = any(s in venue.lower() for s in sections if s != 'patent')
    is_patent = 'US Patent' in venue
    
    if is_patent or match_section:
        filtered_scholar.append(p)

scholar_titles_norm = {normalize(p['title']): p['title'] for p in filtered_scholar}

# Load research.html
with open('research.html', 'r') as f:
    soup = BeautifulSoup(f, 'html.parser')

# We need to find the titles in the specified sections
# Looking at the structure is hard without seeing it, but common structures are <li> or <div> within sections.
# Usually papers are listed in <li> or similar.
# Since I don't know the exact HTML structure, I will look for elements that seem like titles.
# Often research pages use IDs or classes for these sections.

page_titles_raw = []
# Searching for text that looks like titles. 
# A common pattern is list items in a section or specific classes.
# I'll try to find all <li> and see if they look like papers, or anchor tags.
# Actually, the user says "include page sections for...". 
# I'll look for strings within the body and try to extract something that matches if it's in those sections.
# Better: search for common patterns. 

# Let's try to find headers that match the sections and then siblings.
target_sections = ['journal', 'conference', 'book chapter', 'book', 'dissertation', 'patent']
found_titles = []

for section_name in target_sections:
    # Find headers (h1-h6) that contain the section name
    headers = soup.find_all(re.compile('^h[1-6]$'), string=re.compile(section_name, re.I))
    for header in headers:
        # Look for list items or divs following this header until the next header
        curr = header.next_sibling
        while curr and not (curr.name and re.match('^h[1-6]$', curr.name)):
            if curr.name in ['li', 'p', 'div']:
                # Typical paper entry. Often the title is in bold or a link.
                # If there's an <a> or <b>, take it. Else take text.
                strong = curr.find(['strong', 'b', 'a'])
                if strong:
                    found_titles.append(strong.get_text())
                else:
                    text = curr.get_text().strip()
                    if text:
                        found_titles.append(text)
            elif curr.name == 'ul' or curr.name == 'ol':
                items = curr.find_all('li')
                for item in items:
                    strong = item.find(['strong', 'b', 'a'])
                    if strong:
                        found_titles.append(strong.get_text())
                    else:
                        found_titles.append(item.get_text())
            curr = curr.next_sibling

# Clean up found titles from page (remove extra whitespace/newlines)
page_titles_raw = [t.strip() for t in found_titles if len(t.strip()) > 10]
page_titles_norm = {normalize(t): t for t in page_titles_raw}

# Output
scholar_norm_set = set(scholar_titles_norm.keys())
page_norm_set = set(page_titles_norm.keys())

missing_from_page = scholar_norm_set - page_norm_set
missing_from_scholar = page_norm_set - scholar_norm_set

print("Titles on Scholar but missing from the page:")
for t in missing_from_page:
    print(f"- {scholar_titles_norm[t]}")

print("\nTitles on the page but missing from Scholar:")
for t in missing_from_scholar:
    print(f"- {page_titles_norm[t]}")

print(f"\nCounts:")
print(f"Page list count: {len(page_norm_set)}")
print(f"Filtered Scholar list count: {len(scholar_norm_set)}")

# Filtered grants-only patent count. 
# Prompt: "filtered grants-only patent count"
# This likely means entries in filtered_scholar that are 'US Patent' (not App)
patent_count = sum(1 for p in filtered_scholar if 'US Patent' in p.get('venue', '') and 'US Patent App.' not in p.get('venue', ''))
print(f"Filtered grants-only patent count: {patent_count}")

