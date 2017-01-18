import React, {Component} from 'react';
import $ from 'jquery';
import {
  Table,
  Modal,
  Button,
  Form,
  Input,
  Alert,
  Popconfirm,
  message,
} from 'antd';

const {Column} = Table;
const {Item: FormItem} = Form;

export default class InvoiceListPage extends Component {
  static defaultProps = {
    invTemplate: {
      DocNumber: 'HereIsDocNumber',
      DocDate: '2016-01-01',
      Customer: 'Customer Name',
      Total: '100',
      Items: [{
        Name: 'Item Name',
        Quantity: '1.0',
        Amount: '100.0'
      }]
    }
  }

  state = {
    invoices: null,

    //Invoice Modal related
    invModalData: null,
    invModalType: 'edit', // edit/create
    invModalShow: false,
    invModalLoading: false,
    invModalError: null,
  }

  componentDidMount() {
    this.loadInvoices()
      .then(d => {
        this.setState({
          invoices: d
        });

      })
      .catch(ex => {
        console.log(ex);
      });
  }

  loadInvoices() {
    return new Promise((resolve, reject) => {
      $.ajax({
        type: "GET",
        url: '/admin/invoices',
        contentType: 'application/json',
        dataType: 'json',
      }).done(d => {
        return resolve(d.data);
      }).fail(ex => {
        return reject(ex.responseJSON);
      });
    });
  }

  updateOrCreateInvoice(data) {
    return new Promise((resolve, reject) => {
      $.ajax({
        type: "POST",
        url: `/admin/invoices`,
        data: JSON.stringify(data),
        contentType: 'application/json',
        dataType: 'json',
      }).done(d => {
        return resolve(d.data);
      }).fail(ex => {
        return reject(ex.responseJSON);
      });
    });
  }

  deleteInvoice(docNumber) {
    return new Promise((resolve, reject) => {
      $.ajax({
        type: "DELETE",
        url: `/admin/invoices/${docNumber}`,
        contentType: 'application/json',
        dataType: 'json',
      }).done(d => {
        return resolve(d.data);
      }).fail(ex => {
        return reject(ex.responseJSON);
      });
    });
  }

  handleError(ex) {
    alert(JSON.stringify(ex));
  }

  onInvModalOk(e) {
    this.setState({
      invModalLoading: true,
    });

    this.updateOrCreateInvoice(this.state.invModalData)
      .then(d => {
        this.setState({
          invModalShow: false,
          invModalLoading: false,
        });

        message.success('Update successfully');

        return this.loadInvoices();
      })
      .then(d => {
        this.setState({
          invoices: d
        });
      })
      .catch(ex => {
        this.handleError(ex);
        this.setState({
          invModalLoading: false
        });
      });

  }

  onInvModalCancel(e) {
    this.setState({
      invModalShow: false
    });
  }

  onInvModalValueChange(e) {
    let d = null;

    try {
      d = JSON.parse(e.target.value);
    } catch (ex) {

    }
    if (d) {
      this.setState({
        invModalData: d,
        invModalError: null,
      });
    } else {
      this.setState({
        invModalError: 'Invalid JSON'
      });
    }
  }

  onTableRowEdit(docNumber) {
    for (let inv of this.state.invoices) {
      if (inv.DocNumber === docNumber) {
        this.setState({
          invModalData: inv,
        });
        break;
      }
    }

    this.setState({
      invModalShow: true,
      invModelType: 'edit',
    });
  }

  onTableRowDelete(docNumber) {
    this.deleteInvoice(docNumber)
      .then(d => {
        message.success('Delete successfully');
        return this.loadInvoices();
      })
      .then(d => {
        this.setState({
          invoices: d
        });
      })
      .catch(ex => {
        this.handleError(ex);
      });
  }

  onClickAddNewInv(e){
    this.setState({
      invModalType: 'create',
      invModalShow: true,
      invModalLoading: false,
      invModalData: Object.assign({}, this.props.invTemplate),
    });
  }


  render() {
    return (
      <div>
        <div style={{marginBottom: 15}}>
          <Button type="primary" onClick={e=>this.onClickAddNewInv(e)}>Add New Invoice</Button>
        </div>
        <Table dataSource={this.state.invoices}>
          <Column
            title="Doc Number"
            dataIndex="DocNumber"
            key="DocNumber"
          />
          <Column
            title="Doc Date"
            dataIndex="DocDate"
            key="DocDate"
          />
          <Column
            title="Customer"
            dataIndex="Customer"
            key="Customer"
          />
          <Column
            title="Total Amount"
            dataIndex="Total"
            key="Total"
          />
          <Column
            title="Items Count"
            dataIndex="Items"
            key="Items"
            render={item => {
              return (<span>{item.length}</span>);
            }}
          />
          <Column
            title="Action"
            dataIndex="action"
            key="action"
            render={(text, record) => {
              return (
                <span>
                  <a href="javascript:void(0)" onClick={(e) => this.onTableRowEdit(record.DocNumber)}>Edit</a>
                  <span className="ant-divider"/>
                  <Popconfirm title="Are you sure delete this Invoice?"
                              onConfirm={e => this.onTableRowDelete(record.DocNumber)}
                              okText="Yes"
                              cancelText="No">
                    <a href="javascript:void(0)">Delete</a>
                  </Popconfirm>
              </span>)
            }}
          />
        </Table>

        <Modal title={this.state.invModalType === 'create' ? 'Create Invoice Data' : 'Edit Invoice Data'}
               visible={this.state.invModalShow}
               closable={false}
               onOk={e => this.onInvModalOk(e)}
               okText={this.state.invModalType === 'create' ? 'Create' : 'Save'}
               cancelText="Cancel"
               confirmLoading={this.state.invModalLoading}
               onCancel={e => this.onInvModalCancel(e)}
        >
          <Form vertical>
            <FormItem label="Invoice Data (JSON format, notice that all value is 'STRING')">
              <Input type="textarea"
                     autosize={ {minRows: 10, maxRows: 20}}
                     value={JSON.stringify(this.state.invModalData, null, `\t`)}
                     onChange={e => this.onInvModalValueChange(e) }/>
            </FormItem>
            <FormItem>
              {
                this.state.invModalError ? (
                    <Alert message={this.state.invModalError} type="error"/>
                  )
                  : null
              }

            </FormItem>
          </Form>
        </Modal>

      </div>
    )
  }
}