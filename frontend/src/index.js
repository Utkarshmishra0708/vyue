import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { APP_NAME } from './config/brand';

document.title = APP_NAME;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
