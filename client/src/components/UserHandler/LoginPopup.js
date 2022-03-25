// modified from https://codesandbox.io/s/jolly-lovelace-782jr?file=/src/Popup.js:0-654
// ref https://stackoverflow.com/questions/60994423/want-to-show-external-link-page-on-popup-in-react
import React from 'preact/compat'; //'react';
import DDiv from 'async!../Compo/DDiv';
import(/* webpackMode: "lazy" */
       /* webpackPrefetch: true */
       "../../style/style_popup.scss");

class LoginPopup extends React.Component {
/*constructor() {
    super();
  }
  componentDidMount() {
    let ifr = document.getElementById("loginpopup");
    ifr.addEventListener("DOMAttrModified", function(e) {
      if (e.attrName == "src") {
        this.srcOnLoad();
      }
    });
    //this.refs.ifref.getDOMNode().addEventListener('load', this.props.checkAuth);
  }
  async srcOnLoad() { await this.props.checkAuth }
*/
  render() {
    let urlx = this.props.srcurl === "" ? " " : this.props.srcurl;
    const ctent =
      "<iframe id='loginpopup' width='100%' height='100%' scrolling='auto' src=" +
      urlx +
      " sandbox='allow-modals allow-forms allow-popups allow-scripts allow-same-origin'></iframe>";

    //<DDiv ctxt={ctent} id="ssodiv" style="height: auto; overflow-y: auto; font-size: 0.6em; padding: 10px;" />
    //<div id="ssodiv" dangerouslySetInnerHTML={{ __html: ctent }} />
    return (
      <div className="popup" id="loginpopupdiv">
        <div className="popup_inner">
          <DDiv ctxt={ctent} id="ssodiv" style="height: auto; overflow-y: auto; font-size: 0.6em; padding: 10px;" />
          <button id="loginclose" class="popup_close" onClick={this.props.closePopup}>Close</button>
        </div>
      </div>
    );
  }
}
export default LoginPopup;

