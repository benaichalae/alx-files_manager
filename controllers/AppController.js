import redisClient from '../utils/redis';
import dbClient from '../utils/db';

export default class AppController {
  /**
   * Endpoint: /status
   * Method: GET
   * Description: Check if Redis and DB are alive.
   * Response:
   *   - Status Code: 200
   *   - Body: { "redis": true, "db": true } if both are alive
   *           { "error": "error message" } if there's an error
   */
  static getStatus = async (request, response) => {
    try {
      const status = {
        redis: await redisClient.isAlive(),
        db: await dbClient.isAlive(),
      };
      response.status(200).json(status);
    } catch (error) {
      response.status(500).json({ error: error.message });
    }
  };

  /**
   * Endpoint: /stats
   * Method: GET
   * Description: Get the number of users and files in the database.
   * Response:
   *   - Status Code: 200
   *   - Body: { "users": 12, "files": 1231 } with the counts
   *           { "error": "error message" } if there's an error
   */
  static getStats = async (request, response) => {
    try {
      const stats = {
        users: await dbClient.nbUsers(),
        files: await dbClient.nbFiles(),
      };
      response.status(200).json(stats);
    } catch (error) {
      response.status(500).json({ error: error.message });
    }
  };
}
