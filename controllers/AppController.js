/* eslint-disable import/no-named-as-default */
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

export default class AppController {
  /**
   * Responds with the status of the Redis and MongoDB connections.
   * @param {Request} req - The request object.
   * @param {Response} res - The response object.
   */
  static checkStatus(req, res) {
    res.status(200).json({
      redis: redisClient.isAlive(),
      db: dbClient.isAlive(),
    });
  }

  /**
   * Responds with the count of users and files in the database.
   * @param {Request} req - The request object.
   * @param {Response} res - The response object.
   */
  static fetchStats(req, res) {
    Promise.all([dbClient.nbUsers(), dbClient.nbFiles()])
      .then(([usersCount, filesCount]) => {
        res.status(200).json({ users: usersCount, files: filesCount });
      });
  }
}
