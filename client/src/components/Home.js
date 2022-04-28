import { Fragment } from "preact";
import style from './style/style_home.css';
import MultiSelectSort from 'async!./MultiSelectSort';
import { UserContextProvider } from "./UserHandler/UserContext";
//import UserCookies from 'async!./UserHandler/UserCookies';
import UserSearch from 'async!./UserSearch';
import UserHandler from 'async!./UserHandler';

const Home = (props) => (
    <Fragment>
      <div class={style.centerdiv}>
          <h1>API query</h1>
          <p>just testing...</p>
          <UserSearch />
          <br/><hr/><br/>
      </div>
      <div class={style.griddiv}>
        <div class={style.gridleft}>
            <div style="margin:10px;max-width:50%;"><MultiSelectSort /></div>
        </div>
        <div class={style.gridmid} id="outdiv" />
        <div class={style.gridthird}>Some Notation...
            <p id='commentdiv'></p>
        </div>
      </div>
      <div class={style.centerdiv}>
          <br/><hr/><br/>
      </div>

      <UserContextProvider>
          <UserHandler />
      </UserContextProvider>
      <div id='userCookieContainer' />
    </Fragment>
);
export default Home;
