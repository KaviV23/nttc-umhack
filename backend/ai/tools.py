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

# Replace the existing send_emails declaration with this one:

# GrabBack: Send Emails
FunctionDeclaration(
    name="send_emails",
    description="This function can be triggered after showing customers, often following user confirmation (e.g., 'yes', 'okay', 'send them'). It indicates whether emails should be prepared or sent.",
    parameters= {
        "type": "object",
        "properties": {
            "send": { # Changed parameter name for clarity
                "type": "boolean",
                "description": "Set to true if the user has confirmed and emails should proceed. Set to false if just acknowledging the possibility without confirmation.",
            },
        },
        "required": ["send"] # Make the boolean flag mandatory for this function call
    },
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
