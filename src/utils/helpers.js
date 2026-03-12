const he = require("he");

const normalizeHtml = (html) => {
  if (!html) return html;

  return he.decode(html).replace(/\s+/g, " ").trim();
};

//Decode contributionData

const normalizeContributionData = (data) => {
  if (data.definition) {
    Object.keys(data.definition).forEach((lang) => {
      data.definition[lang] = normalizeHtml(data.definition[lang]);
    });
  }
  if (data.detailedExplanation) {
    Object.keys(data.detailedExplanation).forEach((lang) => {
      data.detailedExplanation[lang] = normalizeHtml(
        data.detailedExplanation[lang],
      );
    });
  }
  if (data.example) {
    data.example.map((ex) => {
      const newEx = { ...ex };

      Object.keys(newEx).forEach((lang) => {
        newEx[lang] = normalizeHtml(newEx[lang]);
      });
      return newEx;
    });
  }
  return data;
};
module.exports = {
  normalizeHtml,
  normalizeContributionData,
};
