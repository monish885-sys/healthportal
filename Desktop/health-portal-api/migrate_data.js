const { MongoClient } = require('mongodb');
const fs = require('fs');

// Local MongoDB connection
const localUri = 'mongodb://localhost:27017/health-portal';

// Railway MongoDB connection (using public URL)
const railwayUri = 'mongodb://mongo:JxJCfXGGNJSEuzkLAsgGKVaEOCyhUKIH@trolley.proxy.rlwy.net:41624/health-portal';

async function migrateData() {
    const localClient = new MongoClient(localUri);
    const railwayClient = new MongoClient(railwayUri);
    
    try {
        console.log('Connecting to local MongoDB...');
        await localClient.connect();
        const localDb = localClient.db('health-portal');
        
        console.log('Connecting to Railway MongoDB...');
        await railwayClient.connect();
        const railwayDb = railwayClient.db('health-portal');
        
        const collections = ['users', 'patients', 'doctors', 'admins', 'appointments', 'medicalreports', 'prescriptions', 'symptomanalyses', 'diseasecases', 'diseaseoutbreaks', 'fileuploads', 'feedbacks'];
        
        for (const collectionName of collections) {
            console.log(`\nMigrating collection: ${collectionName}`);
            
            const localCollection = localDb.collection(collectionName);
            const railwayCollection = railwayDb.collection(collectionName);
            
            // Get all documents from local collection
            const documents = await localCollection.find({}).toArray();
            console.log(`Found ${documents.length} documents in ${collectionName}`);
            
            if (documents.length > 0) {
                // Clear existing data in Railway collection
                await railwayCollection.deleteMany({});
                
                // Insert all documents
                await railwayCollection.insertMany(documents);
                console.log(`✅ Successfully migrated ${documents.length} documents to Railway`);
            }
        }
        
        console.log('\n🎉 Data migration completed successfully!');
        
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await localClient.close();
        await railwayClient.close();
    }
}

migrateData();
