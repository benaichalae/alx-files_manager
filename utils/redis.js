import { promisify } from 'util';
import { createClient } from 'redis';

/**
 * Manages connections to a Redis database.
 */
class RedisManager {
  /**
   * Initializes a new RedisManager instance.
   */
  constructor() {
    this.client = createClient();
    this.connectionStatus = true;
    this.client.on('error', (err) => {
      console.error('Error connecting to Redis:', err.message || err.toString());
      this.connectionStatus = false;
    });
    this.client.on('connect', () => {
      this.connectionStatus = true;
    });
  }

  /**
   * Determines if the client is connected to Redis.
   * @returns {boolean}
   */
  isConnected() {
    return this.connectionStatus;
  }

  /**
   * Fetches the value associated with a specific key.
   * @param {String} key The key to look up.
   * @returns {Promise<String | Object>}
   */
  async fetch(key) {
    return promisify(this.client.GET).bind(this.client)(key);
  }

  /**
   * Saves a key-value pair with a specified time-to-live.
   * @param {String} key The key under which the value is stored.
   * @param {String | Number | Boolean} value The value to store.
   * @param {Number} ttl The time-to-live in seconds.
   * @returns {Promise<void>}
   */
  async store(key, value, ttl) {
    await promisify(this.client.SETEX).bind(this.client)(key, ttl, value);
  }

  /**
   * Deletes the value associated with a specific key.
   * @param {String} key The key to delete.
   * @returns {Promise<void>}
   */
  async remove(key) {
    await promisify(this.client.DEL).bind(this.client)(key);
  }
}

export const redisManager = new RedisManager();
export default redisManager;
