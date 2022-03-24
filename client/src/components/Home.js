import style from './style/style_home.css';
import MultiSelectSort from 'async!./MultiSelectSort';
import { UserContextProvider } from "./UserHandler/UserContext";
//import UserCookies from 'async!./UserHandler/UserCookies';
import UserSearch from 'async!./UserSearch';
import UserHandler from 'async!./UserHandler';

const Home = () => (
	<div class={style.home}>
	     <h1>Home</h1>
	     <p>This is the Home component.</p>
             <UserSearch />
             <div style="max-width:50%;"><MultiSelectSort /></div>
             <UserContextProvider>
                <UserHandler />
             </UserContextProvider>
             <div id='userCookieContainer' />
	</div>
);
export default Home;
