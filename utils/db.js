import mongodb from 'mongodb';
// eslint-disable-next-line no-unused-vars
import Collection from 'mongodb/lib/collection';
import loadEnvironment from './env_loader';

/**
 * Handles MongoDB operations.
 */
class MongoConnector {
  /**
   * Initializes a new MongoConnector instance.
   */
  constructor() {
    loadEnvironment();
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const databaseName = process.env.DB_DATABASE || 'files_manager';
    const dbURL = `mongodb://${host}:${port}/${databaseName}`;

    this.client = new mongodb.MongoClient(dbURL, { useUnifiedTopology: true });
    this.client.connect();
  }

  /**
   * Verifies if the connection to MongoDB is active.
   * @returns {boolean}
   */
  isConnected() {
    return this.client.isConnected();
  }

  /**
   * Counts the total number of users.
   * @returns {Promise<Number>}
   */
  async countUsers() {
    return this.client.db().collection('users').countDocuments();
  }

  /**
   * Counts the total number of files.
   * @returns {Promise<Number>}
   */
  async countFiles() {
    return this.client.db().collection('files').countDocuments();
  }

  /**
   * Provides access to the `users` collection.
   * @returns {Promise<Collection>}
   */
  async getUsersCollection() {
    return this.client.db().collection('users');
  }

  /**
   * Provides access to the `files` collection.
   * @returns {Promise<Collection>}
   */
  async getFilesCollection() {
    return this.client.db().collection('files');
  }
}

export const mongoConnector = new MongoConnector();
export default mongoConnector;
