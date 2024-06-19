import express from 'express';
import indexRouter from './routes/index';

const app = express();
const port = process.env.PORT || 5000;

// Middleware to parse JSON bodies
app.use(express.json());

// Mounting the router for the index route
app.use('/', indexRouter);

// Starting the server
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default server;
