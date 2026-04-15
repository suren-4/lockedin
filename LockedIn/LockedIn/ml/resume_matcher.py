import sys
import json
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re

def clean_text(text):
    if not text:
        return ""
    text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text)
    return text.lower().strip()

def extract_keywords(text, vectorizer):
    # Very basic keyword extraction based on tfidf vocab
    words = set(clean_text(text).split())
    vocab = set(vectorizer.get_feature_names_out())
    # Return words present in text that are also in our vectorizer vocab 
    return list(words.intersection(vocab))

def match_resume(resume_text, jd_text):
    try:
        if not resume_text or not jd_text:
            return {"match_score": 0, "status": "success", "missing_keywords": []}

        resume_clean = clean_text(resume_text)
        jd_clean = clean_text(jd_text)

        # Enhanced TF-IDF with Unigrams and Bigrams
        vectorizer = TfidfVectorizer(
            stop_words='english', 
            max_features=1000,
            ngram_range=(1, 2)
        )
        
        # Fit on both documents
        tfidf_matrix = vectorizer.fit_transform([jd_clean, resume_clean])
        
        # Cosine Similarity
        cosine_sim = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        
        # Determine missing keywords from JD
        jd_keywords = set(extract_keywords(jd_clean, vectorizer))
        resume_keywords = set(extract_keywords(resume_clean, vectorizer))
        
        missing = list(jd_keywords - resume_keywords)
        # Return top 10 missing (more comprehensive)
        missing = sorted(missing, key=lambda x: len(x), reverse=True)[:10]

        return {
            "match_score": float(round(cosine_sim * 100, 1)),
            "missing_keywords": missing,
            "extracted_keywords": list(resume_keywords)[:15],
            "status": "success"
        }
        
    except Exception as e:
        return {
            "error": str(e),
            "status": "failed"
        }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Insufficient arguments", "status": "failed"}))
        sys.exit(1)
        
    resume_text = sys.argv[1]
    jd_text = sys.argv[2]
    
    result = match_resume(resume_text, jd_text)
    
    print(json.dumps(result))
