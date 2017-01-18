import React, {Component} from 'react';
import {Button, ButtonArea, Flex, FlexItem} from 'react-weui';
import ScanBtn from './ScanBtn.jsx';
import '../css/Home.css';

require('../img/home_tips.jpg');
require('../img/avatar.jpg');

export default class HomePage extends Component {

  static defaultProps = {
    userName: 'Min'
  };


  render() {
    return (
      <div className="page" style={{padding: 15}}>
        <Flex>
          <FlexItem>
            <div>
              <img src="build/images/avatar.jpg" style={{width: 48, float: 'left', borderRadius: '50%'}}/>
              <h3 style={{float: 'left', lineHeight: '48px', marginLeft: 20}}>Welcome {this.props.userName}</h3>
            </div>
          </FlexItem>
        </Flex>
        <Flex>
          <FlexItem>
            <p className="homepage-text">
              When you are scanning the invoice, place your mobile phone horizontally.
            </p>
            <p className="homepage-text">
              Please make sure the edges of the invoice fit in the rectangle.
            </p>
          </FlexItem>
        </Flex>
        <Flex>
          <FlexItem>
            <div style={{textAlign: 'center'}}>
              <img src='build/images/home_tips.jpg' style={{width: '80%', margin: '10%'}}/>
            </div>
          </FlexItem>
        </Flex>

        <ButtonArea className="homepage-fix-bottom">
          <ScanBtn text="Scan Now"/>
        </ButtonArea>
      </div>
    );
  }
};