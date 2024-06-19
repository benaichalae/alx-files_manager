// eslint-disable-next-line no-unused-vars
import { Express } from 'express';
import AppController from '../controllers/AppController';
import AuthController from '../controllers/AuthController';
import UsersController from '../controllers/UsersController';
import FilesController from '../controllers/FilesController';
import { basicAuthenticate, xTokenAuthenticate } from '../middlewares/auth';
import { APIError, errorHandler } from '../middlewares/error';

/**
 * Sets up the route handlers for the Express application.
 * @param {Express} app - The Express application instance.
 */
const configureRoutes = (app) => {
  // Application status endpoints
  app.get('/status', AppController.getStatus);
  app.get('/stats', AppController.getStats);

  // Authentication endpoints
  app.get('/connect', basicAuthenticate, AuthController.getConnect);
  app.get('/disconnect', xTokenAuthenticate, AuthController.getDisconnect);

  // User management endpoints
  app.post('/users', UsersController.postNew);
  app.get('/users/me', xTokenAuthenticate, UsersController.getMe);

  // File management endpoints
  app.post('/files', xTokenAuthenticate, FilesController.postUpload);
  app.get('/files/:id', xTokenAuthenticate, FilesController.getShow);
  app.get('/files', xTokenAuthenticate, FilesController.getIndex);
  app.put('/files/:id/publish', xTokenAuthenticate, FilesController.putPublish);
  app.put('/files/:id/unpublish', xTokenAuthenticate, FilesController.putUnpublish);
  app.get('/files/:id/data', FilesController.getFile);

  // Handle unknown routes
  app.all('*', (req, res, next) => {
    errorHandler(new APIError(404, `Cannot ${req.method} ${req.url}`), req, res, next);
  });
  
  // General error handling middleware
  app.use(errorHandler);
};

export default configureRoutes;
