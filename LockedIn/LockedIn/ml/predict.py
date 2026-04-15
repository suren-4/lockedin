import sys
import json
import os
import joblib
import pandas as pd

def predict(attendance, lc_easy, lc_medium, lc_hard, study_hours):
    model_path = os.path.join(os.path.dirname(__file__), 'model.pkl')
    
    # Fallback to simple logic if model doesn't exist yet
    if not os.path.exists(model_path):
        return {
            "error": "Model not trained. Run train_model.py first.",
            "readiness_score": min(100, max(0, attendance * 0.4 + lc_easy * 0.05 + lc_medium * 0.15 + lc_hard * 0.4))
        }
    
    try:
        model = joblib.load(model_path)
        
        # Create a dataframe for the input data matching our training features
        input_data = pd.DataFrame({
            'attendance': [float(attendance)],
            'lc_easy': [int(lc_easy)],
            'lc_medium': [int(lc_medium)],
            'lc_hard': [int(lc_hard)],
            'study_hours': [float(study_hours)]
        })
        
        # Predict
        score = model.predict(input_data)[0]
        
        return {
            "readiness_score": float(round(score, 1)),
            "status": "success"
        }
    except Exception as e:
        return {
            "error": str(e),
            "status": "failed"
        }

if __name__ == "__main__":
    # Ensure correct number of arguments passed from Node.js
    if len(sys.argv) < 6:
        print(json.dumps({"error": "Insufficient arguments", "status": "failed"}))
        sys.exit(1)
        
    attendance = sys.argv[1]
    lc_easy = sys.argv[2]
    lc_medium = sys.argv[3]
    lc_hard = sys.argv[4]
    study_hours = sys.argv[5]
    
    result = predict(attendance, lc_easy, lc_medium, lc_hard, study_hours)
    
    # We output JSON so the Node.js backend can parse it directly
    print(json.dumps(result))
