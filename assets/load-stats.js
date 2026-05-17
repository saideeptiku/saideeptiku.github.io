// Load and display publication statistics from Google Scholar data
fetch('google-scholar-papers.json')
  .then(response => response.json())
  .then(data => {
    const summary = data.summary;
    const types = summary.publicationsByType;
    
    function formatNumber(value) {
      return new Intl.NumberFormat('en-US').format(value || 0);
    }

    // Get publication-type stat container
    const statStrip = document.querySelector('#publication-type-stats') || document.querySelector('.stat-strip');
    if (!statStrip) return;
    
    // Clear existing content
    statStrip.innerHTML = '';
    
    // Create stat items dynamically
    const stats = [
      {
        count: types.journal,
        label: 'Journal Papers',
        detail: 'peer-reviewed'
      },
      {
        count: types.conference,
        label: 'Conference Papers',
        detail: 'peer-reviewed'
      },
      {
        count: types.book_chapter,
        label: 'Book Chapters',
        detail: 'peer-reviewed'
      },
      {
        count: types.book,
        label: 'Research Books',
        detail: 'edited volume'
      },
      {
        count: summary.grantedPatents != null ? summary.grantedPatents : types.patent,
        label: 'Patents',
        detail: 'U.S. patents (Justia)'
      },
      {
        count: summary.totalCitations,
        label: 'Total Citations',
        detail: 'Google Scholar'
      }
    ];
    
    stats.forEach(stat => {
      const item = document.createElement('div');
      item.className = 'stat-item';
      item.innerHTML = `
        <strong>${formatNumber(stat.count)}</strong>
        <span>${stat.label}</span>
        <small>${stat.detail}</small>
      `;
      statStrip.appendChild(item);
    });

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
  .catch(error => console.error('Error loading publication statistics:', error));
