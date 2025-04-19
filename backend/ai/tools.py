from google.generativeai.types import FunctionDeclaration

gemini_function_declarations = [
  # GrabBack: Show Customers
  FunctionDeclaration(
    name= "show_customers",
    description= "Shows the merchant's customers along with their last order date and favorite food. Last order date can be filtered out by days ago since customers' last visit.",
    parameters= {
      "type": "object",
      "properties": {
        "daysAgo": {
          "type": "integer",
          "description": "Filter the number of days ago since customers has ordered from the merchant.",
        },
      },
    },
  ),

  # GrabBack: Send Emails
  FunctionDeclaration(
    name="send_emails",
    description="An option the user has after requesting to show customers."
  ),

  # GrabBack: Calculate Total Sales per LLM call
  FunctionDeclaration(
    name="calculate_total_sales",
    description="Calculate total forecasted sales for a specific period between 1 and 30 days from forecast data.",
    parameters={
      "type": "object",
      "properties": {
        "days": {
          "type": "integer",
          "description": "Number of days to calculate total for (must be between 1 and 30)"
        }
      },
      "required": ["days"]
    }
  )
]
