const fs = require('fs');

const inputFile = '/Users/saideeptiku/Library/Application Support/Code/User/workspaceStorage/eb310e62c8f480bc665501a1880e2078/GitHub.copilot-chat/chat-session-resources/b35732f9-7374-4f4b-9d86-6a9c1f012e37/call_BCmscVDDGNszxp9YEQmQPfmC__vscode-1779016200638/content.txt';
const outputFile = '/Users/saideeptiku/Projects/saideeptiku.github.io/google-scholar-papers.json';

const content = fs.readFileSync(inputFile, 'utf8');
const lines = content.split('\n');
const entries = [];

for (const line of lines) {
  if (line.includes('Result: ')) {
    try {
      const jsonStr = line.split('Result: ')[1];
      const data = JSON.parse(jsonStr);
      entries.push(...data);
    } catch (e) {
      // Skip invalid JSON
    }
  }
}

function classify(entry) {
  const venue = (entry.venue || '').toLowerCase();
  const title = (entry.title || '').toLowerCase();
  
  if (/us patent/i.test(venue) || /patent/i.test(venue)) return 'patent';
  if (venue.includes('springer nature')) return 'book';
  if (venue.includes('colorado state university') ||
      title.includes('secure, accurate, real-time, and heterogeneity-resilient indoor localization with smartphones')) return 'dissertation';
  if (venue.includes('machine learning for indoor localization and navigation') || 
      venue.includes('embedded machine learning for cyber-physical')) return 'book_chapter';
  if (venue.includes('conference') || venue.includes('symposium') || venue.includes('proceedings')) return 'conference';
  return 'journal';
}

const processedEntries = entries.map(entry => {
  const citations = parseInt(entry.citations) || 0;
  const year = parseInt(entry.year);
  return {
    ...entry,
    type: classify(entry),
    authors: (entry.authors || '').split(',').map(s => s.trim()).filter(s => s),
    citations: citations,
    year: isNaN(year) ? null : year
  };
});

const stats = {
  totalPublications: processedEntries.length,
  totalCitations: processedEntries.reduce((sum, e) => sum + e.citations, 0),
  publicationsByType: {},
  citationsByType: {},
  publicationsByYear: {}
};

stats.averageCitationsPerPaper = Math.round(stats.totalCitations / stats.totalPublications);

const citationsList = processedEntries.map(e => e.citations).sort((a, b) => b - a);
let hIndex = 0;
while (hIndex < citationsList.length && citationsList[hIndex] >= hIndex + 1) {
  hIndex++;
}
stats.hIndex = hIndex;
stats.i10Index = citationsList.filter(c => c >= 10).length;

let mostCited = null;
processedEntries.forEach(e => {
  stats.publicationsByType[e.type] = (stats.publicationsByType[e.type] || 0) + 1;
  stats.citationsByType[e.type] = (stats.citationsByType[e.type] || 0) + e.citations;
  if (e.year) {
    stats.publicationsByYear[e.year] = (stats.publicationsByYear[e.year] || 0) + 1;
  }
  if (!mostCited || e.citations > mostCited.citations) {
     mostCited = e;
  }
});
stats.mostCitedPaper = mostCited;

const result = {
  author: "Sai Deepak Tiku",
  citations: {
    description: "Citations data retrieved from Google Scholar. 94 entries were loaded from Scholar Articles list.",
    totalCitations: stats.totalCitations,
    hIndex: stats.hIndex,
    i10Index: stats.i10Index,
    averageCitationsPerPaper: stats.averageCitationsPerPaper,
    citationsByType: stats.citationsByType
  },
  publications: {
    totalPublications: stats.totalPublications,
    grantedPatents: 14,
    publicationsByType: stats.publicationsByType,
    publicationsByYear: stats.publicationsByYear,
    mostCitedPaper: stats.mostCitedPaper,
    papers: processedEntries
  },
  dataSource: {
    name: "Google Scholar",
    lastUpdated: "2026-05-17"
  }
};

fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
console.log('Total Publications:', stats.totalPublications);
console.log('Publications By Type:', JSON.stringify(stats.publicationsByType, null, 2));
