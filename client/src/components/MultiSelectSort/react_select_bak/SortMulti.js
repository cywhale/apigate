import { useEffect, useState } from 'preact/hooks';
import { components } from 'react-select';
import { SortableElement } from 'react-sortable-hoc';

const SortMulti = (props) => {
  const [innerProps, setInnerProps] = useState(null);
  const SortableMultiValue = SortableElement(props => {
    // this prevents the menu from being opened/closed when the user clicks
    // on a value to begin dragging it. ideally, detecting a click (instead of
    // a drag) would still focus the control and toggle the menu, but that
    // requires some magic with refs that are out of scope for this example
    const onMouseDown = e => {
      e.preventDefault();
      e.stopPropagation();
    };
    const innerProps = { onMouseDown };
    return innerProps;
  });

  useEffect(() => {
     setInnerProps({ SortableMultiValue });
  }, [props]);

  return (<components.MultiValue {...props} innerProps={innerProps} />);
}
export default SortMulti;
