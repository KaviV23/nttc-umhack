import os
import re
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import json
from typing import Dict, Any, Callable, List

# --- Configuration ---
load_dotenv()
app = FastAPI()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_CHAT_ENDPOINT = f"{OLLAMA_BASE_URL}/api/chat"
OLLAMA_MODEL = "llama3"

# --- Pydantic Models ---
class PromptRequest(BaseModel): # Renamed from Prompt for clarity
    message: str

class AnalyzedIntents(BaseModel):
    sales_intent: str
    discount_intent: str

class ActionRequest(BaseModel): # New model for the action endpoint
    action_name: str
    # Optionally add context if needed, e.g.:
    # sales_intent: str | None = None
    # discount_intent: str | None = None

# --- Helper Functions ---
# (Keep read_prompt_template, call_ollama, extract_intents as before)
def read_prompt_template(filename):
    try:
        with open(filename, 'r') as f: return f.read()
    except FileNotFoundError:
        print(f"[WARN] Prompt file '{filename}' not found.")
        return ""

def call_ollama(prompt_content, model=OLLAMA_MODEL, system_message="You are a helpful assistant."):
    payload = { "model": model, "messages": [{"role": "system", "content": system_message}, {"role": "user", "content": prompt_content}], "stream": False, "options": {"temperature": 0.0} }
    try:
        print(f"--- Calling Ollama ({model}) ---")
        response = requests.post(OLLAMA_CHAT_ENDPOINT, json=payload, timeout=180)
        response.raise_for_status()
        data = response.json()
        if "message" in data and "content" in data["message"]: return data["message"]["content"]
        else:
            print(f"[ERROR] Unexpected Ollama response format: {data}")
            raise ValueError("Unexpected response format from Ollama")
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Error connecting to Ollama: {e}", flush=True)
        raise HTTPException(status_code=503, detail=f"Could not connect to Ollama service: {e}")
    except Exception as e:
        print(f"[ERROR] Error calling Ollama: {str(e)}", flush=True)
        raise HTTPException(status_code=500, detail=f"Error calling LLM: {str(e)}")

def extract_intents(analysis_response: str) -> AnalyzedIntents:
    sales_intent = "None"; discount_intent = "None"
    sales_match = re.search(r"^\s*Sales timing intent:\s*(.*)", analysis_response, re.IGNORECASE | re.MULTILINE)
    discount_match = re.search(r"^\s*Discount timing intent:\s*(.*)", analysis_response, re.IGNORECASE | re.MULTILINE)
    if sales_match:
        extracted = sales_match.group(1).strip().strip('\'"'); sales_intent = extracted if extracted and extracted.lower() != 'none' else "None"
    if discount_match:
        extracted = discount_match.group(1).strip().strip('\'"'); discount_intent = extracted if extracted and extracted.lower() != 'none' else "None"
    return AnalyzedIntents(sales_intent=sales_intent, discount_intent=discount_intent)


# --- Internal Logic Functions (Separated from response formatting) ---

def _generate_sales_forecast_logic() -> Dict[str, Any]:
    """Placeholder for actual sales forecasting logic."""
    print("--- Running Forecast Logic ---")
    # Simulate fetching/calculating data
    # In real app, query database, run model, etc.
    time_period = "upcoming week"
    peak_day = "Friday"
    projected_increase = "5-8%"
    return {
        "status": "Forecast Generated",
        "message": f"Generated forecast for the {time_period}: We predict {peak_day} will be the peak day with a potential sales increase of {projected_increase}. Recommend preparing extra stock for popular items.",
        "details": {"period": time_period, "peak": peak_day, "projection": projected_increase}
    }

def _plan_food_staging_logic() -> Dict[str, Any]:
    """Placeholder for food staging planning logic."""
    print("--- Running Food Staging Logic ---")
    # Simulate planning
    items = ["Hummus Platter", "Quinoa Bites"]
    prep_time = "10:00 AM"
    return {
        "status": "Food Staging Planned",
        "message": f"Planned food staging based on forecast: Prepare extra {', '.join(items)} starting at {prep_time} for the anticipated lunch rush.",
        "details": {"items": items, "prep_start": prep_time}
    }

def _draft_retention_messages_logic() -> Dict[str, Any]:
    """Placeholder for drafting retention messages."""
    print("--- Running Draft Messages Logic ---")
    # Simulate drafting
    message_template = "Hey [Name]! We miss you. Enjoy 15% off your next order this week with code COMEBACK15."
    target_count = 45 # Example
    return {
        "status": "Messages Drafted",
        "message": f"Drafted a retention message for {target_count} inactive customers: '{message_template}'. Ready to review and schedule?",
        "details": {"template": message_template, "count": target_count}
    }

# --- Updated Functions to Format Responses (Called AFTER routing) ---
# These now primarily format messages and suggest actions based on intent

def grab_cast(intents: AnalyzedIntents) -> Dict[str, Any]:
    print(f"--- Formatting grab_cast Response ---")
    # This function's *primary* job now is to offer actions related to sales intent
    return {
        "status": "Intent: Sales Focus",
        "message": f"Okay, you're looking at sales timing/performance: '{intents.sales_intent}'. I can help analyze this further. What would you like to do?",
        "data": { "intent_received": intents.sales_intent },
        # Actions map to the *logic* functions now
        "suggested_actions": ["Generate Sales Forecast", "Plan Food Staging"]
    }

def grab_back(intents: AnalyzedIntents) -> Dict[str, Any]:
    print(f"--- Formatting grab_back Response ---")
     # This function's *primary* job now is to offer actions related to discount/retention intent
    return {
        "status": "Intent: Discount/Retention Focus",
        "message": f"Alright, focusing on your discount timing/strategy idea: '{intents.discount_intent}'. We can use this for retention. How should we proceed?",
        "data": { "intent_received": intents.discount_intent },
         # Actions map to the *logic* functions now
        "suggested_actions": ["Identify Inactive Customers", "Draft Retention Messages"]
    }

def no_action_needed() -> Dict[str, Any]:
    print(f"--- Formatting no_action_needed Response ---")
    return {
        "status": "No specific action needed",
        "message": "Okay, I didn't pick up a specific request about sales or discount timing there. Is there something else I can help you analyze or set up today?",
        "data": None,
        "suggested_actions": []
    }

# --- Map Function Names (from LLM Router) to Response Formatting Functions ---
response_formatter_map: Dict[str, Callable[..., Any]] = {
    "grab_cast": grab_cast,
    "grab_back": grab_back,
    "no_action_needed": no_action_needed
}

# --- Map Action Names (from buttons) to Actual Logic Functions ---
# Make sure these strings EXACTLY match the ones in `suggested_actions` lists above
action_logic_map: Dict[str, Callable[[], Dict[str, Any]]] = {
    "Generate Sales Forecast": _generate_sales_forecast_logic,
    "Plan Food Staging": _plan_food_staging_logic,
    # "Identify Inactive Customers": _identify_inactive_customers_logic, # Add logic if needed
    "Draft Retention Messages": _draft_retention_messages_logic,
}


# --- API Endpoints ---

@app.post("/api/chat")
async def create_chat(request: PromptRequest): # Use renamed Pydantic model
    """
    Handles initial merchant chat, performs intent analysis, routes to a
    RESPONSE FORMATTING function, and returns its result (incl. suggested actions).
    """
    print(f"\n--- Received Request (/api/chat) ---")
    print(f"User Message: {request.message}")

    # === Step 1: Intent Analysis ===
    print("\n--- Step 1: Analyzing Intent ---")
    # ... (Code remains the same: read prompt1, call_ollama, extract_intents) ...
    intent_prompt_template = read_prompt_template("prompt1.txt");
    if not intent_prompt_template: raise HTTPException(status_code=500, detail="Config error (prompt1 missing).")
    try: formatted_intent_prompt = intent_prompt_template % request.message
    except TypeError: raise HTTPException(status_code=500, detail="Config error (prompt1 formatting).")
    intent_analysis = call_ollama(formatted_intent_prompt, system_message="Analyze merchant statement for sales/discount intents per rules.")
    print(f"[DEBUG] Raw intent_analysis:\n{intent_analysis}", flush=True)
    intents = extract_intents(intent_analysis)
    print(f"[DEBUG] Extracted Intents → Sales: '{intents.sales_intent}' | Discount: '{intents.discount_intent}'", flush=True)

    # === Step 2: Determine Function Call (Routing) ===
    print("\n--- Step 2: Determining Function Call ---")
    # ... (Code remains the same: read prompt2, format, call_ollama) ...
    routing_prompt_template = read_prompt_template("prompt2.txt")
    if not routing_prompt_template: raise HTTPException(status_code=500, detail="Config error (prompt2 missing).")
    try: formatted_routing_prompt = routing_prompt_template.format(sales_intent=intents.sales_intent, discount_intent=intents.discount_intent)
    except KeyError as e: raise HTTPException(status_code=500, detail=f"Config error (prompt2 formatting - missing {e}).")
    print(f"[DEBUG] Prompt to router LLM:\n{formatted_routing_prompt}", flush=True)
    chosen_formatter_name = call_ollama(formatted_routing_prompt, system_message="Output ONLY function name: grab_cast, grab_back, or no_action_needed based on rules.").strip()
    print(f"[DEBUG] LLM Suggested Formatter: '{chosen_formatter_name}'", flush=True) # Renamed variable

    # === Step 3: Execute the Chosen FORMATTING Function ===
    print("\n--- Step 3: Formatting Response ---")
    def unknown_formatter_handler():
        print(f"[ERROR] Unknown formatter name from LLM: '{chosen_formatter_name}'")
        return {"status": "Error", "message": "Sorry, I encountered an unexpected issue.", "data": None, "suggested_actions": [] }
    target_formatter = response_formatter_map.get(chosen_formatter_name, unknown_formatter_handler) # Use new map
    formatted_result: Dict[str, Any]
    try:
        if chosen_formatter_name in ["grab_cast", "grab_back"]:
            formatted_result = target_formatter(intents) # Pass intents
        else: # Handles no_action_needed and unknown
            formatted_result = target_formatter()
    except Exception as e:
        print(f"[!!!] Error executing formatter function '{chosen_formatter_name}': {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Error formatting response.")
    print(f"[DEBUG] Formatted Result Dict: {formatted_result}", flush=True)

    # === Step 4: Return Formatted Result (with actions) to Frontend ===
    print("\n--- Step 4: Returning Formatted Result ---")
    return {
        "response": formatted_result.get("message", "Error formatting response."),
        "suggested_actions": formatted_result.get("suggested_actions", [])
        }

# --- NEW Endpoint for Executing Actions ---
@app.post("/api/execute_action")
async def execute_action(request: ActionRequest):
    """
    Executes a specific backend logic function based on the action name provided.
    """
    print(f"\n--- Received Request (/api/execute_action) ---")
    print(f"Action Name: {request.action_name}")

    # Find the corresponding logic function in the map
    logic_function = action_logic_map.get(request.action_name)

    if not logic_function:
        print(f"[ERROR] No logic function found for action: '{request.action_name}'")
        raise HTTPException(status_code=404, detail=f"Action '{request.action_name}' not found.")

    # Execute the logic function
    print(f"--- Executing Action Logic: {request.action_name} ---")
    try:
        # Assuming logic functions currently take no arguments
        # If they need context (like intents), you'd need to pass it in the request
        # and modify the logic function signature.
        action_result = logic_function()
    except Exception as e:
        print(f"[!!!] Error executing action logic '{request.action_name}': {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Error executing action '{request.action_name}'.")

    print(f"[DEBUG] Action Execution Result Dict: {action_result}", flush=True)

    # Return the result message to the frontend
    return {
        "response": action_result.get("message", f"Action '{request.action_name}' completed, but no message generated.")
        # Optionally return other data from action_result if needed by frontend
        # "data": action_result.get("details")
    }


# --- Run the App ---
if __name__ == "__main__":
    import uvicorn
    print("Starting FastAPI server...")
    if not read_prompt_template("prompt1.txt") or not read_prompt_template("prompt2.txt"): exit("[FATAL] Missing prompt1.txt or prompt2.txt.")
    print("Prompt files found.")
    uvicorn.run("main:app", host="0.0.0.0", port=9000, reload=True)