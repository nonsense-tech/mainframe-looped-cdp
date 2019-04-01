import React, { Component } from 'react';
import {
  Col,
  InputNumber,
  Form,
} from 'antd';

import './index.scss';

class CustomForm extends Component {
  validateEthValue = (rule, value, callback) => {
    if (value && value >= 0.01 && value <= 0.1) {
      callback();
    } else {
      callback('The Looper has a limit of 0.1 ETH per transaction.');
    }
  }
  validatePercent = (rule, value, callback) => {
    if (value && value >= 10 && value <= 60) {
      callback();
    } else {
      callback('Rate must be between 10 and 60');
    }
  }
  render() {
    const {
      form: {
        getFieldDecorator,
      },
      changeEthValue,
      changePercentValue,
    } = this.props;
    return (
      <div className="form-container">
        <Form>
          <Col span={11}>
            <Form.Item label="ETH to lock">
              {getFieldDecorator('ethValue', {
                rules: [{
                  validator: this.validateEthValue,
                }],
                initialValue: 0.1,
              })(
                <InputNumber
                  formatter={value => `⧫ ${value}`}
                  parser={value => value.replace('⧫', '')} 
                  onChange={changeEthValue}
                  className="input"
                  size="large"
                />
              )}
            </Form.Item>
          </Col>
          <Col span={2} />
          <Col span={11}>
            <Form.Item label="Rehypothecation rate">
              {getFieldDecorator('percentValue', {
                rules: [{
                  validator: this.validatePercent,
                }],
                initialValue: 50,
              })(
                <InputNumber
                  formatter={value => `${value} %`}
                  parser={value => value.replace('%', '')}
                  onChange={changePercentValue}
                  className="input"
                  size="large"
                />
              )}
            </Form.Item>
          </Col>
        </Form>
      </div>
    );
  }
}

export default Form.create({ name: 'register' })(CustomForm);
