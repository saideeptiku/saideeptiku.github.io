(function () {
  var data = window.googleScholarPapersData;
  if (!data || !Array.isArray(data.publications)) {
    return;
  }

  function normalizeTitle(title) {
    return (title || '')
      .toLowerCase()
      .replace(/\(.*?\)/g, '')
      .replace(/special\s+session\s+paper/gi, '')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function formatAuthors(authors) {
    if (!Array.isArray(authors) || !authors.length) {
      return '';
    }
    if (authors.length === 1) {
      return authors[0] + '.';
    }
    return authors.slice(0, -1).join(', ') + ', and ' + authors[authors.length - 1] + '.';
  }

  function createArticle(prefix, item, options) {
    var article = document.createElement('article');
    article.className = 'activity-item';

    var heading = document.createElement('h3');
    if (options && options.linkUrl) {
      heading.innerHTML = prefix + '. <a href="' + options.linkUrl + '" target="_blank" rel="noopener">' + item.title + '</a>';
    } else {
      heading.textContent = prefix + '. ' + item.title;
    }
    article.appendChild(heading);

    if (item.authors && item.authors.length) {
      var meta = document.createElement('p');
      meta.className = 'meta';
      meta.textContent = formatAuthors(item.authors);
      article.appendChild(meta);
    }

    if (item.venue) {
      var citation = document.createElement('p');
      citation.className = 'citation';
      citation.textContent = item.venue + (item.venue.trim().endsWith('.') ? '' : '.');
      article.appendChild(citation);
    }

    return article;
  }

  function yearSort(a, b) {
    if ((b.year || 0) !== (a.year || 0)) {
      return (b.year || 0) - (a.year || 0);
    }
    return (b.citations || 0) - (a.citations || 0);
  }

  function populateSection(sectionId, entries, prefix, options) {
    var section = document.getElementById(sectionId);
    if (!section) {
      return;
    }
    var list = section.querySelector('.activity-list');
    if (!list) {
      return;
    }

    list.innerHTML = '';
    entries.forEach(function (entry, index) {
      var number = (options && options.numbering === 'ascending')
        ? index + 1
        : entries.length - index;
      var article = createArticle(prefix + number, entry, options);
      list.appendChild(article);
    });
  }

  var publications = data.publications.slice();

  var books = publications.filter(function (p) {
    return p.type === 'book';
  });

  var bookChapters = publications.filter(function (p) {
    return p.type === 'book_chapter';
  }).sort(yearSort);

  var journals = publications.filter(function (p) {
    return p.type === 'journal';
  }).sort(yearSort);

  var conferences = publications.filter(function (p) {
    return p.type === 'conference';
  }).sort(yearSort);

  var dissertation = publications.filter(function (p) {
    var normalized = normalizeTitle(p.title);
    return normalized === 'secure accurate real time and heterogeneity resilient indoor localization with smartphones' ||
      normalized === 'secure accurate realtime and heterogeneity resilient indoor localization with smartphones';
  });

  var grantedPatents = publications.filter(function (p) {
    return /^US Patent(?! App\.)/i.test(p.venue || '');
  }).sort(yearSort);

  populateSection('book', books, 'B', {
    numbering: 'ascending',
    linkUrl: 'https://link.springer.com/book/10.1007/978-3-031-26712-3'
  });

  populateSection('book-chapters', bookChapters, 'BC', {
    numbering: 'descending'
  });

  populateSection('journals', journals, 'J', {
    numbering: 'descending'
  });

  populateSection('conferences', conferences, 'C', {
    numbering: 'descending'
  });

  populateSection('dissertation', dissertation, 'D', {
    numbering: 'ascending',
    linkUrl: 'https://api.mountainscholar.org/server/api/core/bitstreams/3c1cec02-b831-4863-b446-02c8de1fcce2/content'
  });

  populateSection('patents', grantedPatents, 'P', {
    numbering: 'descending'
  });
})();