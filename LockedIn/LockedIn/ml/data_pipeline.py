import pandas as pd
import numpy as np

def generate_mock_data(num_samples=500):
    np.random.seed(42)
    
    # Generate random attendance between 50% and 100%
    attendance = np.random.uniform(50, 100, num_samples)
    
    # Generate Leetcode stats
    lc_easy = np.random.randint(0, 300, num_samples)
    lc_medium = np.random.randint(0, 200, num_samples)
    lc_hard = np.random.randint(0, 50, num_samples)
    
    # Generate study hours
    study_hours = np.random.uniform(5, 40, num_samples)
    
    # Generate a target variable: Placement Readiness Score (0 - 100)
    # The score should positively correlate with attendance and leetcode stats.
    base_score = 30 + (attendance - 50) * 0.5
    lc_score = (lc_easy * 0.05 + lc_medium * 0.15 + lc_hard * 0.4)
    study_score = study_hours * 0.5
    
    noise = np.random.normal(0, 5, num_samples)
    
    readiness_score = base_score + lc_score + study_score + noise
    readiness_score = np.clip(readiness_score, 0, 100) # Keep between 0 and 100
    
    df = pd.DataFrame({
        'attendance': attendance,
        'lc_easy': lc_easy,
        'lc_medium': lc_medium,
        'lc_hard': lc_hard,
        'study_hours': study_hours,
        'readiness_score': readiness_score
    })
    
    return df

def preprocess_data(df):
    """
    In a real scenario, this function would clean the data, handle NaN values, etc.
    """
    df = df.dropna()
    return df

if __name__ == "__main__":
    import os
    print("Generating synthetic student data...")
    df = generate_mock_data()
    df = preprocess_data(df)
    
    os.makedirs(os.path.dirname(__file__), exist_ok=True)
    csv_path = os.path.join(os.path.dirname(__file__), 'student_data.csv')
    df.to_csv(csv_path, index=False)
    print(f"Data saved to {csv_path}")
