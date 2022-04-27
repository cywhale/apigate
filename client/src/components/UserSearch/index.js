import { useState, useEffect } from 'preact/hooks';

const UserSearch = () => {
  const [search, setSearch] = useState('');
  const [result, setResult] = useState('');

  const onLayerSearch = () => {
    let term = document.getElementById("searchtxt").value;
    if (term !== '') {
      console.log('Searching: ', term);
      setSearch(term);
    }
  }

  const sendSearch = async (searchtxt) => {
    let headers = new Headers();
    headers.append('Content-Type', 'application/json; charset=utf-8');
    headers.append('Accept', 'application/json');
    let searchurl = 'search/layers/' + searchtxt;

    try {
      await fetch(searchurl, {
        method: 'GET',
        //mode: 'same-origin',
        //redirect: 'follow',
        //credentials: 'include',
        //withCredentials: true,
        headers: headers,
        //body: JSON.stringify( {})
      })
      .then(res => res.json())
      .then(json => {
        let data = JSON.stringify(json);
        if (data === null || data === '' || data === '{}' || data === '[]') {
          return(setResult('Layer not found!'));
        }
        return(
          setResult(data)
        );
      });
    } catch(err) {
      console.log("Error when search: ", err);
    }
  }

  useEffect(() => {
    if (search !== '') {
      sendSearch(search);
    }
  }, [search]);

  return (
    <div>
      <p><input id='searchtxt' type='text' /><button onClick={onLayerSearch}>Search</button></p>
      <div>{result}</div>
    </div>
  )
};
export default UserSearch;
