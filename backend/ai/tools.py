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
  )
]