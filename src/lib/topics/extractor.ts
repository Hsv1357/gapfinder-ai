import { generateStructuredJSON } from '../gemini';

export interface ExtractedTopicNode {
  title: string;
  level: 'unit' | 'topic' | 'subtopic';
  description?: string;
  estimatedImportance: 'high' | 'medium' | 'low';
  subtopics?: ExtractedTopicNode[];
}

export interface ExtractedSyllabus {
  subjectName: string;
  subjectCode?: string;
  units: ExtractedTopicNode[];
  summary: string;
}

/**
 * Extracts a structured curriculum topic hierarchy from uploaded syllabus text using Gemini.
 * Strictly adheres to the evidence present in the syllabus text without inventing non-existent topics.
 */
export async function extractTopicsFromSyllabus(
  syllabusText: string
): Promise<ExtractedSyllabus> {
  const systemInstruction = `You are a curriculum analysis specialist. 
Your task is to analyze the provided syllabus text and extract the exact academic structure (Subject Name, Units/Modules, Topics, and Subtopics).
CRITICAL RULES:
1. ONLY extract topics that explicitly appear in the provided syllabus text.
2. DO NOT hallucinate, infer, or invent topics that are not mentioned in the source material.
3. Classify importance (high, medium, low) based on explicitly assigned weights, marks, hours, or core relevance indicated in the text.
4. If the text is insufficient or not a syllabus, return an empty units list.`;

  const prompt = `Analyze this syllabus text and output a JSON object with this exact structure:
{
  "subjectName": "Name of the subject/course",
  "subjectCode": "Course code if present (or null)",
  "summary": "Brief summary of course scope",
  "units": [
    {
      "title": "Unit 1 / Module 1: Title",
      "level": "unit",
      "estimatedImportance": "high",
      "description": "Brief summary of unit scope",
      "subtopics": [
        {
          "title": "Topic Name",
          "level": "topic",
          "estimatedImportance": "high",
          "description": "Focus area",
          "subtopics": [
            {
              "title": "Subtopic Name",
              "level": "subtopic",
              "estimatedImportance": "medium",
              "description": "Specific detail"
            }
          ]
        }
      ]
    }
  ]
}

Syllabus Content:
"""
${syllabusText.slice(0, 15000)}
"""`;

  try {
    const result = await generateStructuredJSON<ExtractedSyllabus>({
      prompt,
      systemInstruction,
    });

    if (!result.units || !Array.isArray(result.units) || result.units.length === 0) {
      throw new Error('No structured syllabus units could be detected from the document.');
    }

    return result;
  } catch (error: any) {
    console.error('Syllabus extraction error:', error);
    throw new Error(`Failed to extract topic map: ${error.message}`);
  }
}
