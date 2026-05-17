// Display citation counts on publication items using Google Scholar data.
(function () {
  function normalizeTitle(title) {
    if (!title) return '';
    return title
      .toLowerCase()
      .trim()
      .replace(/^(special\s+session\s+paper:\s*|\s*abstract\s*)/i, '')
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '');
  }

  function titleFromHeading(headingText) {
    return (headingText || '').trim().replace(/^[A-Z]+\d+\.\s+/, '');
  }

  function findBestMatch(htmlTitle, publicationsList) {
    var normalizedHtml = normalizeTitle(htmlTitle);

    for (var i = 0; i < publicationsList.length; i += 1) {
      var exact = publicationsList[i];
      if (normalizeTitle(exact.title) === normalizedHtml) {
        return exact;
      }
    }

    var bestMatch = null;
    var bestScore = 0;
    for (var j = 0; j < publicationsList.length; j += 1) {
      var candidate = publicationsList[j];
      var normalizedDb = normalizeTitle(candidate.title);
      var htmlWords = normalizedHtml.split(/\s+/);
      var dbWords = normalizedDb.split(/\s+/);
      var common = htmlWords.filter(function (w) { return dbWords.indexOf(w) !== -1; });
      var score = common.length / Math.max(htmlWords.length, dbWords.length);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    return bestScore > 0.7 ? bestMatch : null;
  }

  function displayPublicationCitations() {
    fetch('google-scholar-papers.json')
      .then(function (response) { return response.json(); })
      .then(function (data) {
        var publications = (data && data.publications) || [];
        if (!publications.length) return;

        var sections = [
          '#journals .activity-item',
          '#conferences .activity-item',
          '#book-chapters .activity-item',
          '#book .activity-item',
          '#dissertation .activity-item'
        ];

        var matchedCount = 0;
        sections.forEach(function (selector) {
          document.querySelectorAll(selector).forEach(function (item) {
            var h3 = item.querySelector('h3');
            if (!h3) return;

            var existing = item.querySelector('.citation-count-container');
            if (existing) existing.remove();

            var lookupTitle = titleFromHeading(h3.textContent);
            var match = findBestMatch(lookupTitle, publications);
            if (!match || match.citations == null) return;

            var wrapper = document.createElement('div');
            wrapper.className = 'citation-count-container';

            var badge = document.createElement('span');
            badge.className = 'citation-count-badge';
            badge.textContent = match.citations + (match.citations === 1 ? ' citation' : ' citations');

            wrapper.appendChild(badge);
            item.appendChild(wrapper);
            matchedCount += 1;
          });
        });

        console.log('Citation count display (Google Scholar): Matched ' + matchedCount + ' publications');
      })
      .catch(function (error) {
        console.error('Error loading Google Scholar publication citations:', error);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', displayPublicationCitations);
  } else {
    displayPublicationCitations();
  }
})();
