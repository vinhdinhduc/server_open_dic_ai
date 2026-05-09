const Term = require("../models/Term");
const Category = require("../models/Category");

let cachedKnowledge = {
  categories: [],
  commonFields: [],
  examplePatterns: [],
  synonymPatterns: [],
  lastUpdated: null,
};

const KNOWLEDGE_CACHE_TTL = 60 * 60 * 1000;

/**
 * Kiểm tra cache kiến thức có hợp lệ không
 */
const isCacheValid = () => {
  if (!cachedKnowledge.lastUpdated) return false;
  const ageMs = Date.now() - cachedKnowledge.lastUpdated;
  return ageMs < KNOWLEDGE_CACHE_TTL;
};

/**
 * Lấy tất cả danh mục và xây dựng knowledge
 */
const buildCategoryKnowledge = async () => {
  try {
    const categories = await Category.find({ active: true }).lean();
    const categoryMap = categories.map((c) => ({
      id: c._id,
      name: c.name,
      description: c.description,
      examples: [],
    }));

    return categoryMap;
  } catch (error) {
    console.error("Build category knowledge error:", error.message);
    return [];
  }
};

/**
 * Lấy những lĩnh vực phổ biến từ dữ liệu từ vựng
 */
const buildFieldKnowledge = async () => {
  try {
    const fieldsFromTerms = await Term.distinct("field");
    const fieldsSet = new Set(
      fieldsFromTerms.filter((f) => f && typeof f === "string"),
    );

    const fieldExamples = {};

    for (const field of Array.from(fieldsSet).slice(0, 20)) {
      const examples = await Term.find({ field })
        .select("term definition examples")
        .limit(3)
        .lean();

      fieldExamples[field] = examples.map((term) => ({
        name: term.term?.vi || term.term?.en || "",
        definition: term.definition?.vi || term.definition?.en || "",
        examples: (term.examples || []).slice(0, 1),
      }));
    }

    return {
      fields: Array.from(fieldsSet),
      examples: fieldExamples,
    };
  } catch (error) {
    console.error("Build field knowledge error:", error.message);
    return { fields: [], examples: {} };
  }
};

/**
 * Tìm common patterns trong định nghĩa thuật ngữ
 */
const findCommonPatterns = async () => {
  try {
    const sampleTerms = await Term.find()
      .select("term definition partOfSpeech field examples")
      .limit(100)
      .lean();

    const patterns = {
      definitionalStructures: [],
      commonStartPhrases: {},
      examplePatterns: [],
      relationshipPatterns: [],
    };

    // Phân tích structure các định nghĩa
    const nounDefinitions = sampleTerms
      .filter((t) => t.partOfSpeech === "noun" || !t.partOfSpeech)
      .map((t) => t.definition?.vi || "");

    // Tìm common starting phrases
    nounDefinitions.slice(0, 30).forEach((def) => {
      if (!def) return;
      const firstPart = def.split(".")[0].trim();
      const firstWords = firstPart.split(" ").slice(0, 3).join(" ");
      patterns.commonStartPhrases[firstWords] =
        (patterns.commonStartPhrases[firstWords] || 0) + 1;
    });

    // Lấy top patterns
    patterns.definitionalStructures = Object.entries(
      patterns.commonStartPhrases,
    )
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([phrase]) => phrase);

    // Phân tích example patterns
    sampleTerms.forEach((term) => {
      if (term.examples && term.examples.length > 0) {
        patterns.examplePatterns.push({
          term: term.term?.vi || term.term?.en || "",
          exampleCount: term.examples.length,
          exampleStyle: "context-based",
        });
      }
    });

    patterns.examplePatterns = patterns.examplePatterns.slice(0, 20);

    return patterns;
  } catch (error) {
    console.error("Find patterns error:", error.message);
    return {};
  }
};

/**
 * Xây dựng toàn bộ Knowledge Base
 */
const buildFullKnowledge = async () => {
  try {
    console.log("Building knowledge base from vocabulary data...");

    const [categories, fields, patterns] = await Promise.all([
      buildCategoryKnowledge(),
      buildFieldKnowledge(),
      findCommonPatterns(),
    ]);

    cachedKnowledge = {
      categories,
      fields: fields.fields,
      fieldExamples: fields.examples,
      patterns,
      lastUpdated: Date.now(),
    };

    console.log(`Knowledge base built successfully:
      - ${categories.length} categories
      - ${fields.fields.length} fields
      - ${patterns.definitionalStructures?.length || 0} patterns`);

    return cachedKnowledge;
  } catch (error) {
    console.error("Build full knowledge error:", error.message);
    return cachedKnowledge;
  }
};

/**
 * Lấy Knowledge Base (từ cache hoặc rebuild)
 */
const getKnowledge = async (forceRefresh = false) => {
  if (!forceRefresh && isCacheValid()) {
    return cachedKnowledge;
  }

  return await buildFullKnowledge();
};

/**
 * Tìm thuật ngữ tương tự từ Knowledge Base
 */
const findSimilarTerms = async (query, language = "vi", limit = 5) => {
  try {
    const normalizedQuery = query.toLowerCase().trim();

    // Tìm trong database
    const results = await Term.find({
      $or: [
        { "term.vi": { $regex: normalizedQuery, $options: "i" } },
        { "term.en": { $regex: normalizedQuery, $options: "i" } },
        { "definition.vi": { $regex: normalizedQuery, $options: "i" } },
      ],
    })
      .select("term definition field category")
      .limit(limit)
      .lean();

    return results.map((term) => ({
      term: term.term?.[language] || term.term?.vi || term.term?.en || "",
      definition: term.definition?.[language] || term.definition?.vi || "",
      field: term.field,
      similarity: 0.8, // Placeholder, có thể tính toán chính xác hơn
    }));
  } catch (error) {
    console.error("Find similar terms error:", error.message);
    return [];
  }
};

/**
 * Tạo context từ Knowledge Base cho AI prompt
 */
const buildContextFromKnowledge = async (query, language = "vi") => {
  try {
    const knowledge = await getKnowledge();

    // Tìm field liên quan từ query
    const matchedField = knowledge.fields?.find(
      (f) =>
        query.toLowerCase().includes(f.toLowerCase()) ||
        f.toLowerCase().includes(query.toLowerCase().split(" ")[0]),
    );

    // Tìm thuật ngữ tương tự
    const similarTerms = await findSimilarTerms(query, language, 3);

    // Lấy examples từ field liên quan
    const fieldExamples = knowledge.fieldExamples?.[matchedField] || [];

    return {
      matchedField,
      similarTerms,
      fieldExamples,
      patterns: knowledge.patterns,
      definitionStructures: knowledge.patterns?.definitionalStructures || [],
    };
  } catch (error) {
    console.error("Build context error:", error.message);
    return {};
  }
};

/**
 * Cập nhật Knowledge Base một phần (khi có thuật ngữ mới được thêm)
 */
const updateKnowledge = async (updateType = "partial") => {
  try {
    if (updateType === "full" || !isCacheValid()) {
      return await buildFullKnowledge();
    }

    // Cập nhật partial: chỉ rebuild patterns
    const patterns = await findCommonPatterns();
    cachedKnowledge.patterns = patterns;
    cachedKnowledge.lastUpdated = Date.now();

    return cachedKnowledge;
  } catch (error) {
    console.error("Update knowledge error:", error.message);
    return cachedKnowledge;
  }
};

/**
 * Xây dựng AI prompt enhancement từ Knowledge Base
 */
const buildKnowledgeEnhancedPrompt = async (
  basePrompt,
  query,
  language = "vi",
) => {
  try {
    const context = await buildContextFromKnowledge(query, language);

    if (!context.similarTerms?.length) {
      return basePrompt;
    }

    const enhancedContext = `
Từ Knowledge Base của hệ thống:
- Lĩnh vực liên quan: ${context.matchedField || "Chưa xác định"}
- Thuật ngữ tương tự trong hệ thống:
${context.similarTerms
  .map((t) => `  + "${t.term}": ${t.definition}`)
  .join("\n")}

Vui lòng sử dụng thông tin này để cải thiện tính chính xác của câu trả lời.`;

    return `${basePrompt}\n\n${enhancedContext}`;
  } catch (error) {
    console.error("Build enhanced prompt error:", error.message);
    return basePrompt;
  }
};

module.exports = {
  getKnowledge,
  findSimilarTerms,
  buildContextFromKnowledge,
  updateKnowledge,
  buildKnowledgeEnhancedPrompt,
  isCacheValid,
  // Exports cho testing/admin
  buildFullKnowledge,
};
