
const MEMORY_KEY = 'wedo_ai_learning_memory';

export interface LearningRule {
  id: string;
  rule: string;
  timestamp: number;
  active: boolean;
}

export const getLearnedRules = (): LearningRule[] => {
  try {
    const data = localStorage.getItem(MEMORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const addLearningRule = (text: string) => {
  const rules = getLearnedRules();
  const newRule: LearningRule = {
    id: Math.random().toString(36).substr(2, 9),
    rule: text,
    timestamp: Date.now(),
    active: true
  };
  localStorage.setItem(MEMORY_KEY, JSON.stringify([...rules, newRule]));
  return newRule;
};

export const removeLearningRule = (id: string) => {
  const rules = getLearnedRules();
  const filtered = rules.filter(r => r.id !== id);
  localStorage.setItem(MEMORY_KEY, JSON.stringify(filtered));
  return filtered;
};
