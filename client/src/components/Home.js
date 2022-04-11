import style from './style/style_home.css';
//import MultiSelectSort from 'async!./MultiSelectSort';
//import { UserContextProvider } from "./UserHandler/UserContext";
//import UserCookies from 'async!./UserHandler/UserCookies';
import UserSearch from './UserSearch';
//import UserHandler from 'async!./UserHandler';
/* temporarily disable, unsolved CORS error
              <MultiSelectSort />
             <UserContextProvider>
                <UserHandler />
             </UserContextProvider>
*/
const Home = () => (
	<div class={style.home}>
          <div class={style.centerdiv}>
	     <h1>API query</h1>
	     <p>just testing...</p>
             <UserSearch />
             <br/><hr/><br/>
          </div>
          <div class={style.griddiv}>
            <div class={style.gridleft}>
              <div id='userCookieContainer' />
            </div>
            <div class={style.gridmid} id="outdiv" />
            <div class={style.gridthird}>Some Notation...</div>
          </div>
	</div>
);
export default Home;
