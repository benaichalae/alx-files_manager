import { MongoClient } from 'mongodb';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 27017;
const DB_DATABASE = process.env.DB_DATABASE || 'files_manager';
const url = `mongodb://${DB_HOST}:${DB_PORT}`;

class DBClient {
  constructor() {
    this.client = new MongoClient(url, { useUnifiedTopology: true });
    this.db = null;
    this.usersCollection = null;
    this.filesCollection = null;
    
    this.connect();
  }

  async connect() {
    try {
      await this.client.connect();
      this.db = this.client.db(DB_DATABASE);
      this.usersCollection = this.db.collection('users');
      this.filesCollection = this.db.collection('files');
      console.log('Connected successfully to server');
    } catch (err) {
      console.error('Error connecting to database:', err.message);
    }
  }

  isAlive() {
    return Boolean(this.db);
  }

  async nbUsers() {
    try {
      const numberOfUsers = await this.usersCollection.countDocuments();
      return numberOfUsers;
    } catch (err) {
      console.error('Error counting users:', err.message);
      return 0;
    }
  }

  async nbFiles() {
    try {
      const numberOfFiles = await this.filesCollection.countDocuments();
      return numberOfFiles;
    } catch (err) {
      console.error('Error counting files:', err.message);
      return 0;
    }
  }
}

const dbClient = new DBClient();

export default dbClient;
