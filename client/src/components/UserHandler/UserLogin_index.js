import { render } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import Cookies from 'universal-cookie';
import { nanoid } from 'nanoid';
//import { Router, route } from 'preact-router';
//import { Link } from 'preact-router/match';
//import { createBrowserHistory } from 'history';
//import Redirect from '../Redirect';
import Popup from 'async!../Popup';
import style from './style.scss';
const { odbConfig } = require('./.ssologin.js');

const UserLogin = () => {
  const cookies = new Cookies();
//const history = createBrowserHistory();
  const cookieOpts = {
    path: "/",
    //expires: new Date(2020, 10, 30, 20, 20, 0, 30),
    maxAge: 1000 * 60 * 60 * 24,
    secure: true, //active when use https
    sameSite: true,
  };
  const ucodelen = 32;
  const [state, setState] = useState({
    redirect: '',
    popup: false,
    session: false,
  });
  const [user, setUser] = useState({
    name: '',
    //group: ''
  });
  const [ucode, setUcode] = useState({
    str: '',
    //expired:
  });

/*const clickPopup = () => {
    document.getElementById("loginpopup").contentWindow.document.body.onclick = function() {
        console.log(document.getElementById("loginpopup").contentWindow.location);
    }
  }*/
  const closePopup = () => {
    //console.log(document.getElementById('loginpopup').contentWindow.window.location.href);
    OdbAuth(ucode.str);
    setState((preState) => ({
      ...preState,
      popup: false
    }));
  }

  const checkUcode = () => {
    let uc = cookies.get('ucode', { doNotParse: true });
    console.log('Check ucode availability: ', uc)
    if (uc !== null && uc != undefined) {
      if (uc && uc !== '' && uc.length === ucodelen) {
        return (uc);
      }
    }
    return('');
  };

  const sessionInfo = async (url, action, method='POST') => {
    let headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Accept', 'application/json');

    try {
      await fetch(url, {
        method: method,
        mode: 'same-origin',
        redirect: 'follow',
        credentials: 'include',
        withCredentials: true,
        headers: headers,
        body: JSON.stringify({
          action: action
          //cookies: 'ucode',
          //value: ucstr
        })
      })
    } catch(err) {
      console.log("Auth after logined fetch failed: ", err);
    }
  };

  const OdbAuth = async (ucstr) => { //useCallback(() => {
    //const checkOdbAuth = async (ucstr) => {
      const chkurl =  odbConfig.base + odbConfig.check + "?ucode=" + ucstr;
      await fetch(chkurl)
       .then(res => res.json())
       .then(sso => {
          if (sso) {
            if (sso.username && sso.username !== "") {
              sessionInfo('/sessioninfo/login', 'verifyToken', 'POST');
              return(
                setUser((preState) => ({
                  ...preState,
                  name: sso.username
                }))
              );
            }
          }
          return(
            setUser((preState) => ({
              ...preState,
              name: ''
            }))
          );
        });
    //};
    //const uc = ucode.str;
    //if (uc !== '') {
    //  checkOdbAuth(uc);
    //}
  };//,[]);

  const fetchingUcode = (leng=32) => nanoid(leng);

  const renderRedirect = useCallback(() => {
    const rurl = odbConfig.base + odbConfig.login;
    //route(rurl);
    //window.location.href = rurl;
    let location = rurl+"?ucode=" + ucode.str;// + "&nurl="+window.location.href; //no need nurl on iframe
    //history.location; //is an obj with (a.pathname + a.search + a.hash)
    //history.push(rurl+"?ucode=" + ucode.str + "&nurl="+window.location.href);
    setState((preState) => ({
        ...preState,
        redirect: location,
        popup: true
    }));
  }, [ucode.str]);

  const OdbSignIn = () => {
    return(
      <div style='align-items:center;display:flex;flex-direction:column;flex-grow:1;justify-content:center;'>
        <h1>ODB SSO SignIn</h1>
        <button onClick={() => renderRedirect()}>Sign In</button>
      </div>
    );
  };

  const OdbSignOut = () => {
    cookies.remove('ucode', { path: '/' });
    setUcode((preState) => ({
      ...preState,
      str: '',
    }));
    setUser((preState) => ({
      ...preState,
      name: '',
    }));
    setState((preState) => ({
      ...preState,
      redirect: '',
      popup: false
    }));
  };

  const OdbUser = () => {
    return (
      <div style='align-items:center;align-self:stretch;display:flex;justify-content:center;padding-top:16px;'>
            <h1>Welcome! {user.name}</h1>
            <button onClick={() => OdbSignOut()}>Sign Out</button>
      </div>
    );
  };

//https://stackoverflow.com/questions/36824106/express-doesnt-set-a-cookie/42735038
  const initSession = async (ucstr) => {
    let headers = new Headers();
    headers.append('Content-Type', 'application/json');
    headers.append('Accept', 'application/json');

    try {
      await fetch('/sessioninfo/init', {
        method: 'POST',
        mode: 'same-origin',
        redirect: 'follow',
        credentials: 'include',
        withCredentials: true,
        headers: headers,
        body: JSON.stringify({
          action: 'initSession'
          //cookies: 'ucode',
          //value: ucstr
        })
      })
      .then((res) => {
        //console.log("Debug get cookie response: ", res);
        return(
          setState((preState) => ({
            ...preState,
            //res: res,
            session: true,
          }))
        )
      });
    } catch (err) {
      console.log("Init session fetch failed: ", err);
    }
  };

  const initUcode = () => {
      let uc = checkUcode();
      if (uc === '') {
        uc = fetchingUcode(ucodelen);
        cookies.set('ucode', uc, cookieOpts);
      }
      initSession(uc); //move from UserCookies

      setUcode((preState) => ({
          ...preState,
          str: uc
      }));
  }

  useEffect(() => {
  //if (ucode.str === '') {
    if (!state.session) {
      initUcode();
    } else {
      OdbAuth(ucode.str);
    }
  },[state.session]);

  return (
    <section style="display:flex;">
      {user.name === '' &&
        <div>
        <OdbSignIn />
        { state.popup && state.redirect !== '' &&
          <Popup
            srcurl={state.redirect}
            text='Click "Close Button" to hide popup'
            closePopup={ closePopup }
          />
        }
        </div>
      }
      { user.name !== '' && <div style="display:flex">
        <OdbUser /></div>
      }
   </section>
  );
  //}
};
export default UserLogin;
