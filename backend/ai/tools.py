# --- Gemini function definition for showing customers ---
show_customers_function = {
  "name": "show_customers",
  "description": "Shows the merchant's customers along with their last order date and favorite food. Last order date can be filtered out by days ago since customers' last visit.",
  "parameters": {
    "type": "object",
    "properties": {
      "daysAgo": {
        "type": "integer",
        "description": "Filter the number of days ago since customers has ordered from the merchant.",
      },
    },
  },
}