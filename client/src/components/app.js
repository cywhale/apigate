//import { h } from 'preact';
//import { createMemoryHistory } from 'history'; //createHashHistory
import { Router } from 'preact-router';
import Home from './Home';

const App = (props) => {
  return(
    <div id="app">
      <Router>
        <div path='/' style="padding:56px 20px;min-height:100%;width:100%;">
          <Home />
        </div>
      </Router>
    </div>
  );
};
export default App;
