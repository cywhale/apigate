//import { h } from 'preact';
//import { createMemoryHistory } from 'history'; //createHashHistory
import { Router } from 'preact-router';
import Home from './Home';

const App = () => {
  return(
    <div id="app">
      <Router>
        <Home path='/' />
      </Router>
    </div>
  );
};
export default App;
