import React from "preact/compat"; //'react';

class DDiv extends React.Component {
  render() {
    let { ctxt, ...opts } = this.props;
    return <div {...opts} dangerouslySetInnerHTML={{ __html: ctxt }} />;
  }
}
export default DDiv;

