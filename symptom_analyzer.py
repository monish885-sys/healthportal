import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import classification_report
import json
import os
import pickle
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# --- Config: single source for severity/emergency logic (no hardcoding in methods) ---
EMERGENCY_DISEASES = [
    'Heart attack', 'Paralysis (brain hemorrhage)', 'Tuberculosis',
    'AIDS', 'Malaria', 'Typhoid', 'Pneumonia', 'Bronchial Asthma'
]
# Severity thresholds: (emergency_high, emergency_med), (non_emergency_low, med, high)
SEVERITY_CONFIDENCE = {
    'emergency': {'critical': 0.8, 'high': 0.6},   # above 0.8 -> critical, above 0.6 -> high, else medium
    'normal': {'low': 0.9, 'medium': 0.7, 'high': 0.5}  # above 0.9 low, above 0.7 medium, above 0.5 high, else critical
}
RECOMMENDATIONS_BY_SEVERITY = {
    'critical': [
        "Seek immediate medical attention",
        "Contact emergency services if symptoms worsen"
    ],
    'high': [
        "Schedule an appointment with a doctor soon",
        "Monitor symptoms closely"
    ],
    'medium': [
        "Consider consulting a healthcare provider",
        "Monitor symptoms and seek help if they persist"
    ],
    'low': [
        "Continue monitoring symptoms",
        "Consult a doctor if symptoms worsen"
    ]
}
DISEASE_SPECIFIC_RECOMMENDATIONS = {
    ('Heart attack', 'Paralysis (brain hemorrhage)'): "This is a medical emergency - call 911 immediately",
    ('Malaria', 'Typhoid'): "Avoid dehydration and rest adequately",
    'Bronchial Asthma': "Use inhaler if prescribed and avoid triggers",
}

# Training hyperparameters (override via env)
TRAIN_TEST_SIZE = float(os.environ.get("ML_TEST_SIZE", "0.2"))
TRAIN_RANDOM_STATE = int(os.environ.get("ML_RANDOM_STATE", "42"))


class SymptomAnalyzer:
    def __init__(self, dataset_path=None, model_path=None):
        """
        Initialize the Hybrid SymptomAnalyzer with enhanced models
        """
        # Use relative paths from the script location
        script_dir = os.path.dirname(os.path.abspath(__file__))
        self.dataset_path = dataset_path or os.path.join(script_dir, "dataset", "ds.csv")
        self.model_path = model_path or os.path.join(script_dir, "Models")
        self.vectorizer = None
        self.models = {}
        self.best_model = None
        self.df = None
        self.symptoms_list = None
        
        # Create models directory if it doesn't exist
        os.makedirs(self.model_path, exist_ok=True)
        
        # Load or train the models
        self._load_or_train_models()
    
    def _load_or_train_models(self):
        """
        Load existing enhanced models or fallback to basic model
        """
        enhanced_model_file = os.path.join(self.model_path, "enhanced_symptom_model.pkl")
        enhanced_vectorizer_file = os.path.join(self.model_path, "enhanced_vectorizer.pkl")
        
        # Try to load enhanced models first
        if os.path.exists(enhanced_model_file) and os.path.exists(enhanced_vectorizer_file):
            try:
                with open(enhanced_model_file, 'rb') as f:
                    self.models = pickle.load(f)
                with open(enhanced_vectorizer_file, 'rb') as f:
                    self.vectorizer = pickle.load(f)
                self._set_best_model()
                self._load_dataset()
                return
            except Exception as e:
                print(f"Failed to load enhanced models: {e}")
        
        # Fallback to original model files
        model_file = os.path.join(self.model_path, "symptom_model.pkl")
        vectorizer_file = os.path.join(self.model_path, "vectorizer.pkl")
        
        if os.path.exists(model_file) and os.path.exists(vectorizer_file):
            try:
                with open(model_file, 'rb') as f:
                    self.model = pickle.load(f)
                with open(vectorizer_file, 'rb') as f:
                    self.vectorizer = pickle.load(f)
                self.best_model = self.model
                self._load_dataset()
                return
            except Exception as e:
                print(f"Failed to load basic models: {e}")
        
        # If no models exist, train basic model
        print("Training new basic model...")
        self._train_basic_model()
    
    def _load_dataset(self):
        """
        Load the dataset for symptom list extraction
        """
        try:
            self.df = pd.read_csv(self.dataset_path, encoding="ISO-8859-1")
            self._extract_symptoms_list()
        except Exception as e:
            print(f"Error loading dataset: {e}")
            self.df = None
    
    def _extract_symptoms_list(self):
        """
        Extract unique symptoms from the dataset
        """
        if self.df is None:
            return
        
        symptom_cols = [c for c in self.df.columns if c.lower().startswith("symptom")]
        all_symptoms = set()
        
        for col in symptom_cols:
            symptoms = self.df[col].dropna().astype(str)
            for symptom in symptoms:
                if symptom.strip():
                    all_symptoms.add(symptom.strip())
        
        self.symptoms_list = sorted(list(all_symptoms))
    
    def _set_best_model(self):
        """
        Set the best model from loaded models
        """
        if 'Ensemble' in self.models:
            self.best_model = self.models['Ensemble']
        elif 'GradientBoosting' in self.models:
            self.best_model = self.models['GradientBoosting']
        elif 'RandomForest' in self.models:
            self.best_model = self.models['RandomForest']
        else:
            # Use the first available model
            self.best_model = list(self.models.values())[0]
    
    def _train_basic_model(self):
        """
        Train basic Naive Bayes model
        """
        try:
            # Load dataset
            self.df = pd.read_csv(self.dataset_path, encoding="ISO-8859-1")
            
            # Combine multiple symptom columns into one string
            symptom_cols = [c for c in self.df.columns if c.lower().startswith("symptom")]
            self.df[symptom_cols] = self.df[symptom_cols].fillna("")
            self.df["All_Symptoms"] = self.df[symptom_cols].apply(lambda row: " ".join(row.values), axis=1)
            
            # Features and labels
            X = self.df["All_Symptoms"]
            y = self.df["Disease"]
            
            # Train/test split (configurable via ML_TEST_SIZE, ML_RANDOM_STATE)
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=TRAIN_TEST_SIZE, random_state=TRAIN_RANDOM_STATE, stratify=y
            )
            
            # Vectorize text
            self.vectorizer = TfidfVectorizer()
            X_train_vec = self.vectorizer.fit_transform(X_train)
            X_test_vec = self.vectorizer.transform(X_test)
            
            # Train basic model
            self.model = MultinomialNB()
            self.model.fit(X_train_vec, y_train)
            self.best_model = self.model
            
            # Save models
            model_file = os.path.join(self.model_path, "symptom_model.pkl")
            vectorizer_file = os.path.join(self.model_path, "vectorizer.pkl")
            
            with open(model_file, 'wb') as f:
                pickle.dump(self.model, f)
            with open(vectorizer_file, 'wb') as f:
                pickle.dump(self.vectorizer, f)
            
            print(f"Basic model saved to {model_file}")
            
            # Extract symptoms list
            self._extract_symptoms_list()
            
        except Exception as e:
            print(f"Error training basic model: {e}")
            raise
    
    def get_available_symptoms(self):
        """
        Get list of all available symptoms from the dataset
        """
        if self.symptoms_list is None:
            self._extract_symptoms_list()
        return self.symptoms_list or []
    
    def analyze_symptoms(self, symptoms, model_name=None):
        """
        Analyze symptoms and return disease prediction with confidence scores
        """
        if not symptoms or len(symptoms) == 0:
            return {
                "error": "No symptoms provided",
                "success": False
            }
        
        # Select model
        if model_name and model_name in self.models:
            model = self.models[model_name]
            used_model = model_name
        else:
            model = self.best_model
            used_model = "best"
        
        if model is None:
            return {
                "error": "Model not loaded",
                "success": False
            }
        
        try:
            # Convert symptoms to string format
            symptoms_str = " ".join(symptoms)
            
            # Vectorize symptoms
            symptoms_vec = self.vectorizer.transform([symptoms_str])
            
            # Get prediction
            prediction = model.predict(symptoms_vec)[0]
            
            # Get confidence scores for all diseases
            probabilities = model.predict_proba(symptoms_vec)[0]
            
            # Get top 5 predictions with confidence scores
            top_predictions = []
            for disease, score in sorted(zip(model.classes_, probabilities), 
                                      key=lambda x: x[1], reverse=True)[:5]:
                top_predictions.append({
                    "disease": disease,
                    "confidence": float(score)
                })
            
            # Get confidence for the top prediction
            top_confidence = top_predictions[0]["confidence"] if top_predictions else 0
            
            # Determine severity based on confidence and disease type
            severity = self._determine_severity(top_confidence, prediction)
            is_emergency = self._is_emergency_disease(prediction)
            
            # Top 3 symptoms that most triggered this prediction (feature contribution)
            triggering_symptoms = self._get_triggering_symptoms(symptoms, prediction, model, symptoms_vec)
            
            return {
                "success": True,
                "symptoms": symptoms,
                "predictedDisease": prediction,
                "confidence": float(top_confidence),
                "confidencePercentage": round(top_confidence * 100, 2),
                "topPredictions": top_predictions,
                "triggeringSymptoms": triggering_symptoms,
                "analysisDate": datetime.now().isoformat(),
                "modelVersion": "2.0" if len(self.models) > 1 else "1.0",
                "modelUsed": used_model,
                "severity": severity,
                "isEmergency": is_emergency,
                "recommendations": self._get_recommendations(prediction, severity)
            }
            
        except Exception as e:
            return {
                "error": f"Analysis failed: {str(e)}",
                "success": False
            }
    
    def _get_triggering_symptoms(self, symptoms, prediction, model, symptoms_vec):
        """
        Return top 3 symptoms from the user's input that most contributed to the predicted disease.
        Uses feature (term) contribution from the model for the predicted class.
        """
        try:
            # Feature names: vocabulary of the vectorizer
            fn = getattr(self.vectorizer, 'get_feature_names_out', None) or getattr(self.vectorizer, 'get_feature_names', None)
            if fn is None:
                return symptoms[:3] if len(symptoms) >= 3 else symptoms
            feature_names = fn()
            if not hasattr(model, 'feature_log_prob_'):
                # Fallback: return first 3 of user's symptoms that appear in disease's common symptoms
                info = self.get_disease_info(prediction)
                if not info.get('success') or not info.get('commonSymptoms'):
                    return symptoms[:3] if len(symptoms) >= 3 else symptoms
                common = set(s.lower().strip() for s in info['commonSymptoms'])
                matched = [s for s in symptoms if s and s.strip().lower() in common]
                return (matched + [s for s in symptoms if s not in matched])[:3]
            # Class index for predicted disease
            classes = list(model.classes_)
            if prediction not in classes:
                return symptoms[:3] if len(symptoms) >= 3 else symptoms
            class_idx = classes.index(prediction)
            log_probs = model.feature_log_prob_[class_idx]
            # Non-zero indices in the user's symptom vector (sparse or dense)
            if hasattr(symptoms_vec, 'nonzero'):
                nz = symptoms_vec.nonzero()[1]
                if len(nz) == 0:
                    return symptoms[:3] if len(symptoms) >= 3 else symptoms
                vals = np.asarray(symptoms_vec[0, nz]).flatten()
                contributions = vals * log_probs[nz]
                top_pos = np.argsort(-contributions)[:3]
                top_indices = nz[top_pos]
            else:
                vec = np.asarray(symptoms_vec).flatten()
                top_indices = np.argsort(-np.abs(vec * log_probs))[:3]
            names = []
            for idx in top_indices:
                if idx < len(feature_names):
                    name = feature_names[int(idx)]
                    if name and name not in names:
                        names.append(str(name))
                if len(names) >= 3:
                    break
            return names[:3] if names else (symptoms[:3] if len(symptoms) >= 3 else symptoms)
        except Exception:
            return symptoms[:3] if len(symptoms) >= 3 else symptoms
    
    def _determine_severity(self, confidence, disease):
        """
        Determine severity level based on confidence and disease type.
        Uses EMERGENCY_DISEASES and SEVERITY_CONFIDENCE from config.
        """
        if disease in EMERGENCY_DISEASES:
            th = SEVERITY_CONFIDENCE['emergency']
            if confidence > th['critical']:
                return 'critical'
            if confidence > th['high']:
                return 'high'
            return 'medium'
        th = SEVERITY_CONFIDENCE['normal']
        if confidence > th['low']:
            return 'low'
        if confidence > th['medium']:
            return 'medium'
        if confidence > th['high']:
            return 'high'
        return 'critical'

    def _is_emergency_disease(self, disease):
        """Check if the disease is considered an emergency (uses EMERGENCY_DISEASES)."""
        return disease in EMERGENCY_DISEASES

    def _get_recommendations(self, disease, severity):
        """
        Get recommendations based on disease and severity.
        Uses RECOMMENDATIONS_BY_SEVERITY and DISEASE_SPECIFIC_RECOMMENDATIONS.
        """
        recommendations = list(RECOMMENDATIONS_BY_SEVERITY.get(severity, RECOMMENDATIONS_BY_SEVERITY['low']))
        for key, message in DISEASE_SPECIFIC_RECOMMENDATIONS.items():
            if isinstance(key, tuple):
                if disease in key:
                    recommendations.append(message)
                    break
            elif disease == key:
                recommendations.append(message)
                break
        return recommendations
    
    def get_disease_info(self, disease_name):
        """
        Get information about a specific disease from the dataset
        """
        if self.df is None:
            return {"error": "Dataset not loaded"}
        
        try:
            # Filter dataset for the specific disease
            disease_data = self.df[self.df["Disease"].str.lower() == disease_name.lower()]
            
            if disease_data.empty:
                return {"error": f"Disease '{disease_name}' not found in dataset"}
            
            # Get all symptoms for this disease
            symptom_cols = [c for c in self.df.columns if c.lower().startswith("symptom")]
            all_symptoms = set()
            
            for _, row in disease_data.iterrows():
                for col in symptom_cols:
                    symptom = str(row[col]).strip()
                    if symptom and symptom != 'nan':
                        all_symptoms.add(symptom)
            
            return {
                "disease": disease_name,
                "commonSymptoms": sorted(list(all_symptoms)),
                "occurrenceCount": len(disease_data),
                "success": True
            }
            
        except Exception as e:
            return {
                "error": f"Error getting disease info: {str(e)}",
                "success": False
            }

# Global analyzer instance
analyzer = None

def get_analyzer():
    """
    Get or create the global analyzer instance
    """
    global analyzer
    if analyzer is None:
        analyzer = SymptomAnalyzer()
    return analyzer

def analyze_symptoms(symptoms, model_name=None):
    """
    API function to analyze symptoms
    """
    analyzer = get_analyzer()
    return analyzer.analyze_symptoms(symptoms, model_name)

def get_symptoms():
    """
    API function to get available symptoms
    """
    analyzer = get_analyzer()
    return analyzer.get_available_symptoms()

def get_disease_info(disease_name):
    """
    API function to get disease information
    """
    analyzer = get_analyzer()
    return analyzer.get_disease_info(disease_name)

def analyze_symptoms_api(symptoms):
    """
    API function for symptom analysis (used by routes)
    """
    analyzer = get_analyzer()
    return analyzer.analyze_symptoms(symptoms)

def get_symptoms_api():
    """
    API function to get available symptoms (used by routes)
    """
    analyzer = get_analyzer()
    return analyzer.get_available_symptoms()

if __name__ == "__main__":
    # Test the hybrid analyzer
    analyzer = SymptomAnalyzer()
    
    # Test symptoms
    test_symptoms = ["itching", "skin_rash", "nodal_skin_eruptions"]
    result = analyzer.analyze_symptoms(test_symptoms)
    print("Hybrid Analysis Result:")
    print(json.dumps(result, indent=2))
    
    # Test available symptoms
    symptoms = analyzer.get_available_symptoms()
    print(f"\nTotal available symptoms: {len(symptoms)}")
    print("First 10 symptoms:", symptoms[:10])