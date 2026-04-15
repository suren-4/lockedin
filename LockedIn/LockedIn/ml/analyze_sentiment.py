import sys
import json
import os
import joblib

def analyze(text):
    model_path = os.path.join(os.path.dirname(__file__), 'sentiment_model.pkl')
    
    # Fallback to minimal logic if model doesn't exist yet
    if not os.path.exists(model_path):
        is_burnout = any(word in text.lower() for word in ['stress', 'burnout', 'overwhelmed', 'fail', 'quit'])
        return {
            "is_burnout": is_burnout,
            "confidence": 0.85,
            "status": "fallback"
        }
    
    try:
        model = joblib.load(model_path)
        
        # Predict class (0 or 1)
        prediction = model.predict([text])[0]
        # Predict probabilities
        probabilities = model.predict_proba([text])[0]
        confidence = float(probabilities[prediction])
        
        return {
            "is_burnout": bool(prediction == 1),
            "confidence": round(confidence, 2),
            "status": "success"
        }
    except Exception as e:
        return {
            "error": str(e),
            "status": "failed"
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No text provided", "status": "failed"}))
        sys.exit(1)
        
    input_text = sys.argv[1]
    result = analyze(input_text)
    
    print(json.dumps(result))
