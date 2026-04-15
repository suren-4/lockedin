import os
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

def train_sentiment_model():
    print("Training Sentiment Analysis (Burnout Detection) model...")
    # Mock dataset representing student inputs
    texts = [
        "I feel so overwhelmed by my assignments",
        "I can't take this pressure anymore, everything is going wrong",
        "I am so stressed and exhausted",
        "This semester is genuinely burning me out, I want to quit",
        "Too many deadlines, I might fail",
        "I am doing great and feeling productive!",
        "Just finished a Leetcode hard, so happy",
        "I am excited for the upcoming hackathon",
        "Studying with my friends is really fun",
        "Looking forward to my placement interview, feeling confident"
    ]
    # Labels: 1 -> Burnout/Stressed, 0 -> Focused/Happy
    labels = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0]

    # Create an NLP pipeline
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(stop_words='english')),
        ('clf', MultinomialNB())
    ])

    # Train model
    pipeline.fit(texts, labels)

    # Save model
    model_path = os.path.join(os.path.dirname(__file__), 'sentiment_model.pkl')
    joblib.dump(pipeline, model_path)
    print(f"Sentiment model successfully saved to {model_path}")

if __name__ == "__main__":
    train_sentiment_model()
