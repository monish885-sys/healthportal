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

class SymptomAnalyzer:
    def __init__(self, dataset_path=None, model_path=None):
        """
        Initialize the Hybrid SymptomAnalyzer with enhanced models
        """
        self.dataset_path = dataset_path or "/Users/monishbalusu/Desktop/health-portal-api/dataset/ds.csv"
        self.model_path = model_path or "/Users/monishbalusu/Desktop/health-portal-api/Models"
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
            
            # Train/test split
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=y
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
            
            return {
                "success": True,
                "symptoms": symptoms,
                "predictedDisease": prediction,
                "confidence": float(top_confidence),
                "confidencePercentage": round(top_confidence * 100, 2),
                "topPredictions": top_predictions,
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
    
    def _determine_severity(self, confidence, disease):
        """
        Determine severity level based on confidence and disease type
        """
        emergency_diseases = [
            'Heart attack', 'Paralysis (brain hemorrhage)', 'Tuberculosis',
            'AIDS', 'Malaria', 'Typhoid', 'Pneumonia'
        ]
        
        if disease in emergency_diseases:
            if confidence > 0.8:
                return 'critical'
            elif confidence > 0.6:
                return 'high'
            else:
                return 'medium'
        else:
            if confidence > 0.9:
                return 'low'
            elif confidence > 0.7:
                return 'medium'
            elif confidence > 0.5:
                return 'high'
            else:
                return 'critical'
    
    def _is_emergency_disease(self, disease):
        """
        Check if the disease is considered an emergency
        """
        emergency_diseases = [
            'Heart attack', 'Paralysis (brain hemorrhage)', 'Tuberculosis',
            'AIDS', 'Malaria', 'Typhoid', 'Pneumonia', 'Bronchial Asthma'
        ]
        return disease in emergency_diseases
    
    def _get_recommendations(self, disease, severity):
        """
        Get recommendations based on disease and severity
        """
        recommendations = []
        
        if severity == 'critical':
            recommendations.append("Seek immediate medical attention")
            recommendations.append("Contact emergency services if symptoms worsen")
        elif severity == 'high':
            recommendations.append("Schedule an appointment with a doctor soon")
            recommendations.append("Monitor symptoms closely")
        elif severity == 'medium':
            recommendations.append("Consider consulting a healthcare provider")
            recommendations.append("Monitor symptoms and seek help if they persist")
        else:
            recommendations.append("Continue monitoring symptoms")
            recommendations.append("Consult a doctor if symptoms worsen")
        
        # Disease-specific recommendations
        if disease in ['Heart attack', 'Paralysis (brain hemorrhage)']:
            recommendations.append("This is a medical emergency - call 911 immediately")
        elif disease in ['Malaria', 'Typhoid']:
            recommendations.append("Avoid dehydration and rest adequately")
        elif disease in ['Bronchial Asthma']:
            recommendations.append("Use inhaler if prescribed and avoid triggers")
        
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