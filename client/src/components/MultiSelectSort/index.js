//import React from 'preact/compat'
//import DropdownTreeSelect from 'react-dropdown-tree-select';
//For completion, it's possible to make CSS Modules work outside the /components folder?
//https://stackoverflow.com/questions/49118172/preact-cli-css-modules
import { useState, useMemo } from 'preact/hooks';
import { MultiSelectContainer } from './MultiSelectContainer';
import 'react-dropdown-tree-select/dist/styles.css'
//import '../../style/style_dropdown.scss';
import data from './data.json';

const MultiSelectSort = () => {
  const [ selected, setSelected ] = useState({
    val: [],
    type: [],
    format: [],
  });
  const rdata = [...data];

  const onChange = useMemo(() => (_, selectedNodes) => {
    let valx = [];
    let typex = [];
    let formatx = [];

    const getCurrDataFormat = (item) => {
      if (item.hasOwnProperty('type')) {
          typex.push(item.type);
      }
      if (item.hasOwnProperty('format')) {
          formatx.push(item.format);
      }
    };

    selectedNodes.map((item) => {
      if (item.hasOwnProperty('_children')) {
        item._children.map((child) => {
          let nodex = child.substring(6).split("-").reduce(
            (prev, curr) => {
              let leaf = prev[parseInt(curr)];

              if (leaf.hasOwnProperty('children')) {
                return leaf.children;
              } else {
                getCurrDataFormat(leaf);
                return leaf.value;
              }
            },
            rdata
          ); //rdts1-0-0-0
          if (typeof nodex !== 'string' && nodex.length>1) {
            nodex.map((item) => {
              getCurrDataFormat(item);
              valx.push(item.value);
            });
          } else {
            valx.push(nodex);
          }
        });
      } else {
        getCurrDataFormat(item);
        valx.push(item.value);
      }
    });
    console.log('Get leaf value: ', valx);
    setSelected((preState) => ({
      ...preState,
      val: [...valx],
      type: [...typex],
      format: [...formatx]
    }));
  }, []);

  return(
    <MultiSelectContainer data={data} onChange={onChange} inlineSearchInput={true} />
  );
};
export default MultiSelectSort;
