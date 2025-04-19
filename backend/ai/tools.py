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
    name="yes_please_send_emails",
    description="This is a function that is executed conditionally after'show_customers' has been executed, and any agreement terms like 'yes', 'yeah', 'alright'--post-condition--will trigger this function exectuion as well."
  ),

  # GrabBack: Calculate Total Sales per LLM call
  FunctionDeclaration(
    name="calculate_total_sales",
    description="Calculate total forecasted sales for a specific period between 1 and 30 days from forecast data. You may also infer the number of days from terms referring to a period such as weeks, months, fortnights, etc.",
    parameters={
      "type": "object",
      "properties": {
        "days": {
          "type": "integer",
          "description": "Number of days to calculate total for (must be between 1 and 30), and you may also infer the number of days from terms referring to a period such as weeks, months, fortnights, etc.",
        }
      },
      "required": ["days"]
    }
  ),

  # GrabBack: Get Forecasted Quantities
  FunctionDeclaration(
    name="get_forecasted_quantities",
    description="Get forecasted quantities for each food item for a specific period between 1 and 30 days. You may also infer the number of days from terms referring to a period such as weeks, months, fortnights, etc.",
    parameters={
      "type": "object",
      "properties": {
        "days": {
          "type": "integer",
          "description": "Number of days to get forecast for (must be between 1 and 30), and you may also infer the number of days from terms referring to a period such as weeks, months, fortnights, etc."
        }
      },
      "required": ["days"]
    }
  ),

  # GrabBack: Get Actual Quantities
  FunctionDeclaration(
    name="get_actual_quantities",
    description="Get actual historical quantities sold for each food item for a specific period between 1 and 30 days. You may also infer the number of days from terms referring to a period such as weeks, months, fortnights, etc.",
    parameters={
      "type": "object",
      "properties": {
        "days": {
          "type": "integer",
          "description": "Number of past days to retrieve data for (must be between 1 and 30), and you may also infer the number of days from terms referring to a period such as weeks, months, fortnights, etc."
        }
      },
      "required": ["days"]
    }
  )
]
