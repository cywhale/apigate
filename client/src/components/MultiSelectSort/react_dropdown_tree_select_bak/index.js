//import React from 'preact/compat'
import DropdownTreeSelect from 'react-dropdown-tree-select';
//For completion, it's possible to make CSS Modules work outside the /components folder?
//https://stackoverflow.com/questions/49118172/preact-cli-css-modules
//import '../../style/select_style.css';
import 'react-dropdown-tree-select/dist/styles.css'
import data from './data.json';

const rdata = [...data];

const onChange = (curNode, selectedNodes) => {
  console.log('onChange::', curNode, selectedNodes)
  let valx = [];
  selectedNodes.map((item) => {
    if (item.hasOwnProperty('_children')) {
      item._children.map((child) => {
        let nodex = child.substring(6).split("-").reduce(
          (prev, curr) => {
            let leaf = prev[parseInt(curr)];
            if (leaf.hasOwnProperty('children')) {
              return leaf.children;  
            } else {
            return leaf.value;
            }
          },
          rdata
        ); //rdts1-0-0-0
        if (typeof nodex !== 'string' && nodex.length>1) {
          nodex.map((item) => {
            valx.push(item.value);
          });
        } else {
          valx.push(nodex);
        }
      });
    } else {
      valx.push(item.value);
    }
  });
  console.log('Get leaf value: ', valx);
}
const onAction = (node, action) => {
  console.log('onAction::', action, node)
}
const onNodeToggle = curNode => {
  console.log('onNodeToggle::', curNode)
}

const MultiSelectSort = () => (
  <div>
    <DropdownTreeSelect data={data} onChange={onChange} onAction={onAction} onNodeToggle={onNodeToggle} inlineSearchInput={true} />
  </div>
)

export default MultiSelectSort
