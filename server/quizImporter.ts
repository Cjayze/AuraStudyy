export interface ImportedQuestion {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  options: string[];
  correct_ans: string;
  explanation: string;
}

interface QuestionDraft {
  number: number;
  questionLines: string[];
  options: Map<string, string[]>;
  markedAnswer?: string;
  answer?: string;
  explanationLines: string[];
  currentOption?: string;
}

const japaneseChoiceLabels = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ';
const answerLinePattern = /^\s*(?:đáp\s*án(?:\s+đúng)?|đ\s*\/\s*a|answer(?:\s+key)?|ans(?:wer)?|correct\s+(?:answer|option)|正解|解答|正答)\s*(?::|：|=|is|là)?\s*[（(\[]?\s*([A-Z]|[アイウエオカキクケコサシスセソタチツテトナニヌネノ])(?:[）)\]]|\b)?/i;
const optionPattern = /^\s*(?:[（(\[]\s*)?([A-Z]|[アイウエオカキクケコサシスセソタチツテトナニヌネノ])(?:\s*(?:[）)\].．。、:：]|[-－])\s*|\s+)(.*?)\s*$/i;
const choiceKey = (label: string) => {
  const normalized = label.toUpperCase();
  const japaneseIndex = japaneseChoiceLabels.indexOf(normalized);
  return japaneseIndex >= 0 ? String.fromCharCode(65 + japaneseIndex) : (/^[A-Z]$/.test(normalized) ? normalized : undefined);
};

function matchQuestionHeading(line: string): { number: number; text: string } | null {
  const match = line.match(/^\s*(?:(?:câu|question|ques|q|問|問題)\s*)?(\d{1,4})(?:\s*(?:[.)．】【。:：、-]\s*|\s+)(.*)|\s*)$/i);
  if (!match) return null;
  return { number: Number(match[1]), text: (match[2] || '').trim() };
}

function collectAnswerKey(line: string, answers: Map<number, string>): boolean {
  // Compact, labelled, separated, bracketed, and table-cell answer pairs.
  const normalized = line
    .replace(/(?:đáp\s*án(?:\s+đúng)?|answer(?:\s+key)?|correct\s+(?:answer|option)|正解|解答|正答)/giu, ' ')
    .replace(/[-.:)）\]、,;|｜│\t]+/g, ' ')
    .replace(/\s+/g, ' ');
  const pairPattern = /(?:^|[^\p{L}\p{N}])(?:câu|question|q)?\s*(\d{1,4})\s*(?:[-.:)）\]、,;|]\s*|\s+)?[（(\[]?\s*([A-Z]|[アイウエオカキクケコサシスセソタチツテトナニヌネノ])\s*[）)\]]?(?=$|[^\p{L}\p{N}])/giu;
  let found = false;
  for (const match of normalized.matchAll(pairPattern)) {
    const answer = choiceKey(match[2]);
    if (answer) answers.set(Number(match[1]), answer);
    found = true;
  }
  return found;
}

function parseLabeledAnswer(line: string): { number?: number; answer: string } | null {
  if (/^\s*(?:answers?|correct\s+answers?)\s*[:：]?\s*$/i.test(line)) return null;
  const label = '(?:đáp\\s*án(?:\\s+đúng)?|answer(?:\\s+key)?|ans(?:wer)?|correct\\s+(?:answer|option))';
  const patterns = [
    new RegExp(`^\\s*(?:(?:câu|question|q)\\s*)?(\\d{1,4})\\s*[:.)-]\\s*${label}\\s*(?:là|is|[:：=.])?\\s*[（(\\[]?\\s*([A-Z])(?![\\p{L}\\p{N}])`, 'iu'),
    new RegExp(`^\\s*${label}\\s*(?:câu|question|q)?\\s*(\\d{1,4})?\\s*(?:là|is|[:：=.])?\\s*[（(\\[]?\\s*([A-Z])(?![\\p{L}\\p{N}])`, 'iu')
  ];
  for (const [index, pattern] of patterns.entries()) {
    const match = line.match(pattern);
    if (!match) continue;
    const number = index === 0 ? Number(match[1]) : Number(match[1] || 0);
    const answer = choiceKey(match[2]);
    if (answer) return { ...(number ? { number } : {}), answer };
  }
  return null;
}

function parseInlineAnswer(line: string): string | undefined {
  const match = line.match(/(?:\[|\(|（)?\s*(?:đáp\s*án(?:\s+đúng)?|đ\s*\/\s*a|answer(?:\s+key)?|ans(?:wer)?|correct\s+(?:answer|option))\s*(?:là|is|[:：=])?\s*[（(\[]?\s*([A-Z]|[アイウエオカキクケコサシスセソタチツテトナニヌネノ])\s*[）)\]]?\s*(?:\]|\))?/i);
  return match ? choiceKey(match[1]) : undefined;
}

function markedOption(text: string): { text: string; marked: boolean; answer?: string } {
  const explicitAnswer = text.match(/(?:đáp\s*án(?:\s+đúng)?|correct\s+(?:answer|option)|answer)\s*[:：=]?\s*[（(\[]?\s*([A-Z])\s*[）)\]]?/i);
  const marked = Boolean(explicitAnswer) || /(?:\[\s*[x✓✔]\s*\]|☑|✓|✔|[（(\[]\s*(?:correct(?:\s+answer)?|đáp\s*án(?:\s+đúng)?|đúng|正解)\s*[）)\]])/i.test(text);
  const cleanText = text
    .replace(/(?:đáp\s*án(?:\s+đúng)?|correct\s+(?:answer|option)|answer)\s*[:：=]?\s*[（(\[]?\s*[A-Z]\s*[）)\]]?/gi, '')
    .replace(/\[\s*[x✓✔]\s*\]|☑|✓|✔|[（(\[]\s*(?:correct(?:\s+answer)?|đáp\s*án(?:\s+đúng)?|đúng|正解)\s*[）)\]]/gi, '')
    .trim();
  return { text: cleanText, marked, ...(explicitAnswer ? { answer: choiceKey(explicitAnswer[1]) } : {}) };
}

/**
 * Parse a plain-text multiple-choice exam without translating or rewriting its content.
 * Supported layout: numbered questions with A-Z options and an answer per question or key.
 */
export function parseMultipleChoiceExam(text: string): ImportedQuestion[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const drafts: QuestionDraft[] = [];
  const answerKey = new Map<number, string>();
  const answerKeyLines: string[] = [];
  const unnumberedKeyAnswers: string[] = [];
  let pendingKeyNumber: number | undefined;
  let current: QuestionDraft | undefined;
  let inAnswerKey = false;

  const beginQuestion = (number: number, heading: string) => {
    if (current) drafts.push(current);
    current = {
      number,
      questionLines: [heading],
      options: new Map(),
      explanationLines: []
    };
    inAnswerKey = false;
  };

  for (const rawLine of lines) {
    // DOCX/TXT conversions can preserve Markdown emphasis around headings and
    // answer rows (for example **ANSWER KEY** or **1B - 2C**).
    const line = rawLine.replace(/\*\*|__/g, '').replace(/`/g, '').trim();
    if (!line) continue;

    const inlineAnswer = parseInlineAnswer(line);
    const questionOnLine = matchQuestionHeading(line);
    if (inlineAnswer && questionOnLine) {
      beginQuestion(questionOnLine.number, questionOnLine.text.replace(/\s*[\[(（]\s*(?:đáp\s*án(?:\s+đúng)?|đ\s*\/\s*a|answer(?:\s+key)?|ans(?:wer)?|correct\s+(?:answer|option))\s*(?:là|is|[:：=])?\s*[（(\[]?\s*[A-Z]\s*[）)\]]?\s*[\])）]?\s*$/i, '').trim());
      if (current) current.answer = inlineAnswer;
      continue;
    }

    if (inlineAnswer && current && !answerLinePattern.test(line)) {
      current.answer = inlineAnswer;
      const withoutAnswer = line.replace(/\s*[\[(（]\s*(?:đáp\s*án(?:\s+đúng)?|đ\s*\/\s*a|answer(?:\s+key)?|ans(?:wer)?|correct\s+(?:answer|option))\s*(?:là|is|[:：=])?\s*[（(\[]?\s*[A-Z]\s*[）)\]]?\s*[\])）]?\s*$/i, '').trim();
      if (current.currentOption && withoutAnswer) current.options.get(current.currentOption)?.push(withoutAnswer);
      current.currentOption = undefined;
      continue;
    }

    const labelledAnswer = parseLabeledAnswer(line);
    if (labelledAnswer) {
      if (labelledAnswer.number) answerKey.set(labelledAnswer.number, labelledAnswer.answer);
      else if (current) current.answer = labelledAnswer.answer;
      continue;
    }

    // A single "Answer: B" directly under a question is an inline answer,
    // not the beginning of a document-wide answer-key section.
    const prefixedAnswer = line.match(answerLinePattern);
    if (current && prefixedAnswer) {
      current.answer = choiceKey(prefixedAnswer[1]);
      current.currentOption = undefined;
      continue;
    }

    // DOCX extraction can omit the answer-key heading. Detect answer-key rows by
    // their repeated number+letter pairs, even when the heading is missing.
    const answerKeyHeading = line.match(/^\s*(?:answer\s*key\s*[\/|–—-]\s*đáp\s*án|đáp\s*án\s*[\/|–—-]\s*answer\s*key|đáp\s*án(?:\s+(?:đúng|theo\s+hàng\s+ngang|ở\s+(?:cuối|dưới)|dưới\s+cùng|cuối\s+(?:file|đề|cùng)|các\s+câu|từng\s+câu|cho\s+từng\s+câu))?|bảng\s+đáp\s*án|answer(?:\s*key)?|answers|correct\s+answers?|key|正解一覧|解答一覧|(?:câu|question)\s*(?:no\.?)?\s*[|｜│\t]\s*(?:đáp\s*án|answer))(?:\s*[:：]\s*|\s+|$)(.*)$/i);
    if (answerKeyHeading && (current || drafts.length > 0)) {
      inAnswerKey = true;
      answerKeyLines.push(answerKeyHeading[1]);
      continue;
    }

    const answerPairCount = [...line.matchAll(/(?:^|[^\p{L}\p{N}])\d{1,4}\s*(?:[-.:)）|｜│\t]\s*)?[A-Z](?=$|[^\p{L}\p{N}])/giu)].length;
    const looksLikeAnswerKeyRow = answerPairCount >= 2 && answerPairCount >= (line.match(/\d+/g) || []).length * 0.75;
    if (looksLikeAnswerKeyRow && (current || drafts.length > 0)) {
      inAnswerKey = true;
      answerKeyLines.push(line);
      collectAnswerKey(line, answerKey);
      continue;
    }

    // Some DOCX files label the key as "Đáp án theo hàng ngang" and place
    // exactly one answer pair on each line. Treat compact number+letter lines
    // in the trailing section as key rows even when there is only one pair.
    const compactAnswerPair = line.match(/^\s*(?:(?:câu|question|q)\s*)?(\d{1,4})\s*(?:[-.:)）|｜│\t]\s*|\s+)?([A-Z])\s*$/i);
    if (current && compactAnswerPair && Number(compactAnswerPair[1]) <= 1000) {
      inAnswerKey = true;
      answerKeyLines.push(line);
      collectAnswerKey(line, answerKey);
      continue;
    }

    if (inAnswerKey) {
      answerKeyLines.push(line);
      collectAnswerKey(line, answerKey);
      const numberOnly = line.match(/^(?:câu\s*)?(\d{1,4})\s*[.):]?$/i);
      const answerOnly = line.match(/^[（(\[]?\s*([A-Z]|[アイウエオカキクケコサシスセソタチツテトナニヌネノ])\s*[）)\].,;]?$/i);
      if (numberOnly) pendingKeyNumber = Number(numberOnly[1]);
      else if (answerOnly) {
        const answer = choiceKey(answerOnly[1]);
        if (pendingKeyNumber && answer) answerKey.set(pendingKeyNumber, answer);
        else if (answer) unnumberedKeyAnswers.push(answer);
        pendingKeyNumber = undefined;
      }
      if (!numberOnly && !answerOnly && !/\d/.test(line) && /^[\s()[\]{}A-Z,;|\/.-]+$/i.test(line)) {
        unnumberedKeyAnswers.push(...(line.match(/[A-Z]/gi) || []).map((answer) => answer.toUpperCase()));
      }
      // Ignore labels and page numbers within the answer-key section.
      continue;
    }

    const heading = matchQuestionHeading(line);
    if (heading) {
      const trailingAnswer = heading.text.match(/\s+(?:đáp\s*án(?:\s+đúng)?|answer|correct\s+answer)\s*(?:là|is|[:：=])\s*[（(\[]?\s*([A-Z])\s*[）)\]]?\s*$/i);
      beginQuestion(heading.number, trailingAnswer ? heading.text.slice(0, trailingAnswer.index).trim() : heading.text);
      if (trailingAnswer && current) current.answer = choiceKey(trailingAnswer[1]);
      continue;
    }
    if (!current) continue;

    const answerMatch = line.match(answerLinePattern);
    if (answerMatch) {
      current.answer = choiceKey(answerMatch[1]);
      current.currentOption = undefined;
      continue;
    }

    const optionMatch = line.match(optionPattern);
    if (optionMatch) {
      const sourceLabel = optionMatch[1];
      const letter = choiceKey(sourceLabel);
      if (!letter) continue;
      const parsedOption = markedOption(optionMatch[2]);
      current.options.set(letter, [parsedOption.text]);
      current.currentOption = letter;
      if (parsedOption.marked) current.markedAnswer = parsedOption.answer || letter;
      continue;
    }

    const bareAnswer = line.match(/^[（(\[]?\s*([A-Z])\s*[）)\]]?[.!]?$/i);
    if (bareAnswer && current) {
      current.answer = choiceKey(bareAnswer[1]);
      current.currentOption = undefined;
      continue;
    }

    const explanationMatch = line.match(/^\s*(?:giải thích|explanation|解説)\s*[:：]?\s*(.*)$/i);
    if (explanationMatch) {
      current.explanationLines.push(explanationMatch[1]);
      current.currentOption = undefined;
      continue;
    }
    if (current.explanationLines.length > 0) {
      current.explanationLines.push(line);
    } else if (current.currentOption) {
      current.options.get(current.currentOption)?.push(line);
    } else {
      current.questionLines.push(line);
    }
  }

  if (current) drafts.push(current);
  // DOCX tables may separate the question number and answer into adjacent cells.
  collectAnswerKey(answerKeyLines.join(' '), answerKey);
  if (unnumberedKeyAnswers.length === drafts.length) {
    drafts.forEach((draft, index) => answerKey.set(draft.number, unnumberedKeyAnswers[index]));
  }
  if (drafts.length === 0) {
    const hasAnswerKey = answerKey.size > 0 || answerKeyLines.length > 0;
    throw new Error(hasAnswerKey
      ? 'Đã đọc thấy bảng đáp án nhưng chưa nhận diện được nội dung câu hỏi. Hãy tải lên file có cả câu hỏi và các lựa chọn, đánh số từng câu (ví dụ: “Câu 1” hoặc “1.”) và gắn nhãn lựa chọn A, B, C...'
      : 'Không nhận diện được câu hỏi. Hãy đánh số từng câu (ví dụ: “Câu 1” hoặc “1.”) và gắn nhãn các lựa chọn liên tiếp từ A.');
  }

  const missingAnswers: number[] = [];
  const imported = drafts.map((draft, index) => {
    const populatedLetters = [...draft.options.keys()].sort();
    const expectedLetters = Array.from({ length: populatedLetters.length }, (_, i) => String.fromCharCode(65 + i));
    if (populatedLetters.length < 2 || populatedLetters.length > 26 || populatedLetters.some((letter, i) => letter !== expectedLetters[i])) {
      throw new Error(`Câu ${draft.number || index + 1} cần có ít nhất hai lựa chọn liên tiếp, bắt đầu từ A (tối đa Z).`);
    }

    const correct = answerKey.get(draft.number) || draft.answer || draft.markedAnswer;
    if (!correct || !populatedLetters.includes(correct)) missingAnswers.push(draft.number || index + 1);

    const optionText = (letter: string) => (draft.options.get(letter) || []).join('\n').trim();
    return {
      question_text: draft.questionLines.join('\n').trim(),
      option_a: optionText('A'),
      option_b: optionText('B'),
      option_c: optionText('C'),
      option_d: optionText('D'),
      options: expectedLetters.map(optionText),
      correct_ans: correct || 'A',
      explanation: draft.explanationLines.join('\n').trim()
    };
  });

  if (missingAnswers.length > 0) {
    const sample = missingAnswers.slice(0, 10).join(', ');
    const rest = missingAnswers.length > 10 ? ` và ${missingAnswers.length - 10} câu khác` : '';
    throw new Error(`Chưa tìm thấy đáp án đúng cho câu ${sample}${rest}. Hãy thêm đáp án cạnh từng câu hoặc phần Answer Key/Đáp án ở cuối file.`);
  }

  return imported;
}


