// Starter questions in the chat, per role (the API's role values)
export const SUGGESTED_QUESTIONS = {
  owner: ['Which branch is the most profitable, and why?', 'How much money is at risk from expired or expiring stock?', 'How did this month compare with the month before?'],
  pharmacist: ['What should I restock first?', 'Which batches should I use or move before they expire?', 'Can another branch send me anything I am short of?'],
  cashier: ['How are sales today compared with yesterday?', 'Which best sellers are about to run out?', 'When are my busiest hours?'],
  purchase_officer: ['What should I order this week, and how many?', 'Which supplier has the best price for each product?', 'Which orders still need payment or receiving?']
}

export const suggestionsFor = (role) => SUGGESTED_QUESTIONS[role] || SUGGESTED_QUESTIONS.pharmacist
