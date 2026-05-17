// Display citation counts on publication items
function displayPublicationCitations() {
  if (!window.publicationCitations || !Array.isArray(window.publicationCitations)) {
    console.warn('Publication citations data not available');
    return;
  }

  function normalizeTitle(title) {
    // Normalize title for matching: lowercase, trim, remove extra spaces and special chars
    if (!title) return '';
    return title
      .toLowerCase()
      .trim()
      .replace(/^(special\s+session\s+paper:\s*|\s*abstract\s*)/i, '') // Remove "special session paper:" prefix
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, ''); // Remove all special characters
  }

  function findBestMatch(htmlTitle, publicationsList) {
    const normalizedHtml = normalizeTitle(htmlTitle);
    
    // Try exact match first
    for (let pub of publicationsList) {
      if (normalizeTitle(pub.title) === normalizedHtml) {
        return pub.citations;
      }
    }
    
    // Try partial match (check if normalized db title contains normalized html title or vice versa)
    for (let pub of publicationsList) {
      const normalizedDb = normalizeTitle(pub.title);
      // Check if they're similar enough (at least 70% overlap in words)
      const htmlWords = normalizedHtml.split(/\s+/);
      const dbWords = normalizedDb.split(/\s+/);
      const commonWords = htmlWords.filter(w => dbWords.includes(w));
      const similarity = commonWords.length / Math.max(htmlWords.length, dbWords.length);
      
      if (similarity > 0.7) {
        console.debug('Partial match: "' + htmlTitle + '" matched with similarity ' + (similarity * 100).toFixed(0) + '%');
        return pub.citations;
      }
    }
    
    return undefined;
  }

  // Find all publication items and add citation counts
  const sections = [
    { selector: '#journals .activity-item', type: 'journal' },
    { selector: '#conferences .activity-item', type: 'conference' },
    { selector: '#book-chapters .activity-item', type: 'book-chapter' },
    { selector: '#book .activity-item', type: 'book' },
    { selector: '#dissertation .activity-item', type: 'dissertation' },
    // Exclude patents as they don't have OpenAlex citations
  ];

  let matchedCount = 0;
  sections.forEach(function(section) {
    document.querySelectorAll(section.selector).forEach(function(item) {
      const h3 = item.querySelector('h3');
      if (!h3) return;

      // Extract title - get the full text content
      let titleForLookup = h3.textContent.trim();
      
      // Remove leading identifiers and period (e.g., "J1.", "C8.", "BC14.", "D1.")
      titleForLookup = titleForLookup.replace(/^[A-Z]+\d+\.\s+/, '');
      
      const citations = findBestMatch(titleForLookup, window.publicationCitations);

      if (citations !== undefined && citations >= 0) {
        // Find the DOI for this publication
        let doi = undefined;
        for (let pub of window.publicationCitations) {
          if (normalizeTitle(pub.title) === normalizeTitle(titleForLookup.replace(/^[A-Z]+\d+\.\s+/, ''))) {
            doi = pub.doi;
            break;
          }
        }
        
        // Create a citation badge link
        let badgeLink;
        if (doi) {
          // Create a link to OpenAlex search by DOI
          badgeLink = document.createElement('a');
          badgeLink.href = 'https://openalex.org/works?filter=cites:' + encodeURIComponent(doi);
          badgeLink.target = '_blank';
          badgeLink.rel = 'noopener';
          badgeLink.className = 'citation-badge-link';
          badgeLink.title = 'View citing works on OpenAlex';
        } else {
          badgeLink = document.createElement('span');
        }
        
        const badge = document.createElement('span');
        badge.className = 'citation-count-badge';
        badge.textContent = citations + (citations === 1 ? ' citation' : ' citations');
        
        badgeLink.appendChild(badge);
        
        // Add to the activity-item at the top right
        const wrapper = document.createElement('div');
        wrapper.className = 'citation-count-container';
        wrapper.appendChild(badgeLink);
        item.appendChild(wrapper);
        matchedCount++;
        console.debug('Matched: ' + titleForLookup + ' (' + citations + ' citations) - DOI: ' + (doi || 'none'));
      }
    });
  });
  
  console.log('Citation count display: Matched ' + matchedCount + ' publications');
}

// Run when document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', displayPublicationCitations);
} else {
  displayPublicationCitations();
}
