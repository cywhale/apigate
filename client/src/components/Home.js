import { Fragment } from "preact";
import style from './style/style_home.css';
//import MultiSelectSort from 'async!./MultiSelectSort';
//import { UserContextProvider } from "./UserHandler/UserContext";
//import UserCookies from 'async!./UserHandler/UserCookies';
//import UserSearch from './UserSearch';
//import UserHandler from 'async!./UserHandler';
/* temporarily disable, unsolved CORS error
            <UserSearch />
              <MultiSelectSort />
             <UserContextProvider>
                <UserHandler />
             </UserContextProvider>
*/
const Home = () => (
	<Fragment>
          <div class={style.centerdiv}>
	     <h1>API query</h1>
	     <p>just testing...</p>
             <br/><hr/><br/>
          </div>
          <div class={style.griddiv}>
            <div class={style.gridleft}>
              <div id='userCookieContainer' />
            </div>
            <div class={style.gridmid} id="outdiv" />
            <div class={style.gridthird}>Some Notation...</div>
          </div>
	</Fragment>
);
export default Home;
