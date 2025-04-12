import os
import re
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import json
from typing import Dict, Any, Callable, List # Import List

# --- Configuration ---
load_dotenv()
app = FastAPI()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_CHAT_ENDPOINT = f"{OLLAMA_BASE_URL}/api/chat"
OLLAMA_MODEL = "llama3"

# --- Pydantic Models ---
class Prompt(BaseModel):
    message: str

class AnalyzedIntents(BaseModel):
    sales_intent: str
    discount_intent: str

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

# --- Define Your Actual Functions Here ---
# *** ADD suggested_actions field to return dictionaries ***
def grab_cast(intents: AnalyzedIntents) -> Dict[str, Any]:
    print(f"--- Executing grab_cast ---")
    print(f"Received intents: Sales='{intents.sales_intent}', Discount='{intents.discount_intent}'")
    return {
        "status": "Executed grab_cast",
        "message": f"Okay, you're looking at boosting sales around this time: '{intents.sales_intent}'. I can analyze historical data and provide a sales forecast for that period. This will help us plan strategies like Food Staging or optimizing rider availability. Would you like me to generate that forecast?",
        "data": { "intent_received": intents.sales_intent },
        "suggested_actions": ["Generate Sales Forecast", "Plan Food Staging"] # <-- ADDED
    }

def grab_back(intents: AnalyzedIntents) -> Dict[str, Any]:
    print(f"--- Executing grab_back ---")
    print(f"Received intents: Sales='{intents.sales_intent}', Discount='{intents.discount_intent}'")
    return {
        "status": "Executed grab_back",
        "message": f"Alright, focusing on your discount timing idea: '{intents.discount_intent}'. This is great for repeat business! I can help identify customers for personalized 'come back' messages. Shall we look at setting up a retention campaign?",
        "data": { "intent_received": intents.discount_intent },
        "suggested_actions": ["Identify Inactive Customers", "Draft Retention Messages"] # <-- ADDED
    }

def no_action_needed() -> Dict[str, Any]:
    print(f"--- Executing no_action_needed ---")
    return {
        "status": "No specific action needed",
        "message": "Okay, I didn't pick up a specific request about sales or discount timing there. Is there something else I can help you analyze or set up today?",
        "data": None,
        "suggested_actions": [] # <-- ADDED (empty list)
    }

# --- Map Function Names to Functions ---
function_map: Dict[str, Callable[..., Any]] = {
    "grab_cast": grab_cast,
    "grab_back": grab_back,
    "no_action_needed": no_action_needed
}

# --- API Endpoint ---
@app.post("/api/chat")
async def create_chat(prompt: Prompt):
    print(f"\n--- Received Request ---"); print(f"User Message: {prompt.message}")

    # === Step 1: Intent Analysis ===
    print("\n--- Step 1: Analyzing Intent ---")
    intent_prompt_template = read_prompt_template("prompt1.txt");
    if not intent_prompt_template: raise HTTPException(status_code=500, detail="Config error (prompt1 missing).")
    try: formatted_intent_prompt = intent_prompt_template % prompt.message
    except TypeError: raise HTTPException(status_code=500, detail="Config error (prompt1 formatting).")
    intent_analysis = call_ollama(formatted_intent_prompt, system_message="Analyze merchant statement for sales/discount intents per rules.")
    print(f"[DEBUG] Raw intent_analysis:\n{intent_analysis}", flush=True)
    intents = extract_intents(intent_analysis)
    print(f"[DEBUG] Extracted Intents → Sales: '{intents.sales_intent}' | Discount: '{intents.discount_intent}'", flush=True)

    # === Step 2: Determine Function Call ===
    print("\n--- Step 2: Determining Function Call ---")
    routing_prompt_template = read_prompt_template("prompt2.txt")
    if not routing_prompt_template: raise HTTPException(status_code=500, detail="Config error (prompt2 missing).")
    try: formatted_routing_prompt = routing_prompt_template.format(sales_intent=intents.sales_intent, discount_intent=intents.discount_intent)
    except KeyError as e: raise HTTPException(status_code=500, detail=f"Config error (prompt2 formatting - missing {e}).")
    print(f"[DEBUG] Prompt to router LLM:\n{formatted_routing_prompt}", flush=True)
    chosen_function_name = call_ollama(formatted_routing_prompt, system_message="Output ONLY function name: grab_cast, grab_back, or no_action_needed based on rules.").strip()
    print(f"[DEBUG] LLM Suggested Function: '{chosen_function_name}'", flush=True)

    # === Step 3: Execute the Chosen Function ===
    print("\n--- Step 3: Executing Function ---")
    def unknown_function_handler():
        print(f"[ERROR] Unknown function name from LLM: '{chosen_function_name}'")
        return {"status": "Error", "message": "Sorry, I encountered an unexpected issue.", "data": None, "suggested_actions": [] } # Include empty actions
    target_function = function_map.get(chosen_function_name, unknown_function_handler)
    execution_result: Dict[str, Any]
    try:
        if chosen_function_name in ["grab_cast", "grab_back"]: execution_result = target_function(intents)
        else: execution_result = target_function() # Handles no_action_needed and unknown
    except Exception as e:
        print(f"[!!!] Error executing function '{chosen_function_name}': {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Error executing action.")
    print(f"[DEBUG] Execution Result Dict: {execution_result}", flush=True)

    # === Step 4: Format Final Response FOR FRONTEND ===
    print("\n--- Step 4: Formatting Response ---")

    # Extract the primary message
    final_response_text = execution_result.get("message", "Sorry, I couldn't process that request properly.")
    if not isinstance(final_response_text, str):
        final_response_text = str(final_response_text) # Ensure it's a string

    # Extract suggested actions, defaulting to an empty list
    suggested_actions = execution_result.get("suggested_actions", [])
    if not isinstance(suggested_actions, list):
        suggested_actions = [] # Ensure it's a list

    print(f"[DEBUG] Final response text: '{final_response_text}'", flush=True)
    print(f"[DEBUG] Suggested actions: {suggested_actions}", flush=True)

    # *** Return structure with both message and actions ***
    return {
        "response": final_response_text,
        "suggested_actions": suggested_actions
        }

# --- Run the App ---
if __name__ == "__main__":
    import uvicorn
    print("Starting FastAPI server...")
    if not read_prompt_template("prompt1.txt") or not read_prompt_template("prompt2.txt"): exit("[FATAL] Missing prompt1.txt or prompt2.txt.")
    print("Prompt files found.")
    uvicorn.run("main:app", host="0.0.0.0", port=9000, reload=True)