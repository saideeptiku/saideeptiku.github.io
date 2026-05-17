// Load and display publication statistics from Google Scholar data
function fetchScholarData() {
  if (window.googleScholarPapersData) {
    return Promise.resolve(window.googleScholarPapersData);
  }

  const candidates = [
    'google-scholar-papers.json',
    './google-scholar-papers.json',
    '/google-scholar-papers.json'
  ];

  function tryNext(index) {
    if (index >= candidates.length) {
      throw new Error('Unable to load google-scholar-papers.json from known paths');
    }

    return fetch(candidates[index], { cache: 'no-store' })
      .then(response => {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ' for ' + candidates[index]);
        }
        return response.json();
      })
      .catch(() => tryNext(index + 1));
  }

  return tryNext(0);
}

fetchScholarData()
  .then(data => {
    const summary = data.summary;
    const types = summary.publicationsByType;
    
    function formatNumber(value) {
      return new Intl.NumberFormat('en-US').format(value || 0);
    }

    function setPublicationStat(name, value) {
      const el = document.querySelector("[data-publication-stat='" + name + "']");
      if (el && value != null) {
        el.textContent = formatNumber(value);
      }
    }

    setPublicationStat('journal', types.journal);
    setPublicationStat('conference', types.conference);
    setPublicationStat('book_chapter', types.book_chapter);
    setPublicationStat('book', types.book);
    setPublicationStat('patents', summary.grantedPatents != null ? summary.grantedPatents : types.patent);
    setPublicationStat('totalCitations', summary.totalCitations);

    // Populate citation impact metrics that should mirror Google Scholar.
    function setImpactStat(name, value) {
      const el = document.querySelector("[data-impact-stat='" + name + "']");
      if (el && value != null) {
        el.textContent = formatNumber(value);
      }
    }

    setImpactStat('hIndex', summary.hIndex);
    setImpactStat('i10Index', summary.i10Index);
    setImpactStat('totalCitations', summary.totalCitations);
  })
  .catch(error => {
    console.error('Error loading publication statistics:', error);
  });
