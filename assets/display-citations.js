// Display citation counts on publication items
(function() {
  if (!window.publicationCitations) {
    return; // Data not loaded
  }

  function normalizeTitle(title) {
    // Normalize title for matching: lowercase, trim, remove extra spaces
    return title ? title.toLowerCase().trim().replace(/\s+/g, ' ') : '';
  }

  // Build a normalized lookup map
  const citationLookup = {};
  window.publicationCitations.forEach(function(pub) {
    if (pub.title) {
      const normalized = normalizeTitle(pub.title);
      citationLookup[normalized] = pub.citations;
    }
  });

  // Find all publication items and add citation counts
  const sections = [
    { selector: '#journals .activity-item', type: 'journal' },
    { selector: '#conferences .activity-item', type: 'conference' },
    { selector: '#book-chapters .activity-item', type: 'book-chapter' },
  ];

  sections.forEach(function(section) {
    document.querySelectorAll(section.selector).forEach(function(item) {
      const h3 = item.querySelector('h3');
      if (!h3) return;

      // Extract title (remove prefix like "J1.", "C8.", "BC14.")
      let titleText = h3.textContent.trim();
      // Remove leading identifiers and period
      titleText = titleText.replace(/^[A-Z]+\d+\.\s+/, '');
      
      // Handle links - get text content instead
      let titleForLookup = titleText;
      const link = h3.querySelector('a');
      if (link) {
        titleForLookup = link.textContent.trim();
      }

      const normalized = normalizeTitle(titleForLookup);
      const citations = citationLookup[normalized];

      if (citations !== undefined && citations >= 0) {
        // Create a citation badge
        const badge = document.createElement('span');
        badge.className = 'citation-count-badge';
        badge.textContent = citations + (citations === 1 ? ' citation' : ' citations');
        
        // Add to the h3 after the title content
        const metaP = item.querySelector('.meta');
        if (metaP) {
          // Insert before the meta paragraph
          const wrapper = document.createElement('div');
          wrapper.className = 'citation-count-container';
          wrapper.appendChild(badge);
          metaP.parentNode.insertBefore(wrapper, metaP);
        }
      }
    });
  });
})();
