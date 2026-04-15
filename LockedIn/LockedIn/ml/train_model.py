import os
import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_squared_error, r2_score

from data_pipeline import generate_mock_data, preprocess_data

def train():
    # 1. Data Ingestion & Processing
    print("Ingesting data...")
    csv_path = os.path.join(os.path.dirname(__file__), 'student_data.csv')
    
    if not os.path.exists(csv_path):
        print(f"Data file not found at {csv_path}. Generating new data...")
        df = generate_mock_data()
        df = preprocess_data(df)
        df.to_csv(csv_path, index=False)
    else:
        df = pd.read_csv(csv_path)

    X = df[['attendance', 'lc_easy', 'lc_medium', 'lc_hard', 'study_hours']]
    y = df['readiness_score']

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # 2. Model Training
    print("Training Random Forest Regressor model...")
    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('regressor', RandomForestRegressor(n_estimators=100, random_state=42))
    ])

    pipeline.fit(X_train, y_train)

    # Evaluation
    predictions = pipeline.predict(X_test)
    mse = mean_squared_error(y_test, predictions)
    r2 = r2_score(y_test, predictions)
    
    print(f"Model Evaluation -> MSE: {mse:.2f}, R2 Score: {r2:.2f}")

    # Save model
    model_path = os.path.join(os.path.dirname(__file__), 'model.pkl')
    joblib.dump(pipeline, model_path)
    print(f"Model successfully saved to {model_path}")

if __name__ == "__main__":
    train()
